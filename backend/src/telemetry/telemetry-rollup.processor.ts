import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { RedisService } from '../redis/redis.service';
import { TelemetryMetric } from './entities/telemetry-metric.entity';
import {
  PERIOD_MS,
  clicksKey,
  countriesKey,
  dwellKey,
  eventTypesKey,
  lcpKey,
  pagesKey,
  previousPeriodKey,
  scrollKey,
  sessionDurationKey,
  sessionsKey,
  ttfbKey,
  utmSourceKey,
} from './telemetry-aggregation-keys.util';
import {
  TELEMETRY_ROLLUP_JOB_ID,
  TELEMETRY_ROLLUP_QUEUE,
} from './telemetry-rollup.queue';

type Bucket = { key: string; count: number }[];

function topEntries(hash: Record<string, string>, limit = 20): Bucket {
  return Object.entries(hash)
    .map(([key, count]) => ({ key, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// A session can fire session_end more than once (external_data.md section
// 1's documented tab-hide quirk, durationMs climbing each time) — group by
// sessionId and keep only the max per session before computing stats over
// *sessions*, not raw fires, so repeats don't skew the distribution toward
// the smaller early values.
function dedupeSessionDurations(entries: string[]): number[] {
  const maxBySession = new Map<string, number>();
  for (const entry of entries) {
    const separatorIndex = entry.lastIndexOf(':');
    if (separatorIndex === -1) continue;
    const sessionId = entry.slice(0, separatorIndex);
    const durationMs = Number(entry.slice(separatorIndex + 1));
    if (!Number.isFinite(durationMs)) continue;
    const existing = maxBySession.get(sessionId);
    if (existing === undefined || durationMs > existing) {
      maxBySession.set(sessionId, durationMs);
    }
  }
  return Array.from(maxBySession.values());
}

const numOrNull = (n: number | null): string | null => n?.toString() ?? null;

// The metrics engine (external_data.md roadmap item 8 redesign): on a
// 5-minute cadence, reads the just-closed period's Redis aggregate keys for
// every project, computes real numbers — including actual percentiles via
// the raw-sample lists, not just means from a sum/count pair — and writes
// one TelemetryMetric row per project+period. The dashboard reads only that
// table, never Redis or raw events directly. Consumed keys are deleted
// afterward; nothing here is meant to be read twice.
@Processor(TELEMETRY_ROLLUP_QUEUE)
export class TelemetryRollupProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(TelemetryRollupProcessor.name);

  constructor(
    @InjectQueue(TELEMETRY_ROLLUP_QUEUE)
    private readonly queue: Queue,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(TelemetryMetric)
    private readonly metrics: Repository<TelemetryMetric>,
    private readonly redis: RedisService,
  ) {
    super();
  }

  // Registers the repeatable job once at boot via BullMQ's Job Scheduler
  // API (bullmq v6+ — the older `{ repeat: {...} }` option on `add()` is
  // gone). A stable scheduler id makes this idempotent across restarts
  // (dev's watch-mode reload included): `upsertJobScheduler` recognizes the
  // same id and updates it in place rather than stacking up duplicates.
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(TELEMETRY_ROLLUP_JOB_ID, {
      every: PERIOD_MS,
    });
  }

  async process(_job: Job): Promise<void> {
    const period = previousPeriodKey(new Date());
    const projects = await this.projects.find();

    await Promise.all(
      projects.map((project) =>
        this.rollupProject(project.id, period).catch((err: unknown) => {
          this.logger.error(
            `Rollup failed for project=${project.id} period=${period}: ${String(err)}`,
          );
        }),
      ),
    );
  }

  private async rollupProject(
    projectId: string,
    period: string,
  ): Promise<void> {
    const client = this.redis.client;
    const keys = {
      pages: pagesKey(projectId, period),
      clicks: clicksKey(projectId, period),
      countries: countriesKey(projectId, period),
      scroll: scrollKey(projectId, period),
      utmSources: utmSourceKey(projectId, period),
      eventTypes: eventTypesKey(projectId, period),
      sessions: sessionsKey(projectId, period),
      lcp: lcpKey(projectId, period),
      ttfb: ttfbKey(projectId, period),
      dwell: dwellKey(projectId, period),
      sessionDuration: sessionDurationKey(projectId, period),
    };

    const [
      pages,
      clicks,
      countries,
      scroll,
      utmSources,
      eventTypes,
      sessionsRaw,
      lcpRaw,
      ttfbRaw,
      dwellRaw,
      sessionDurationRaw,
    ] = await Promise.all([
      client.hgetall(keys.pages),
      client.hgetall(keys.clicks),
      client.hgetall(keys.countries),
      client.hgetall(keys.scroll),
      client.hgetall(keys.utmSources),
      client.hgetall(keys.eventTypes),
      client.get(keys.sessions),
      client.lrange(keys.lcp, 0, -1),
      client.lrange(keys.ttfb, 0, -1),
      client.lrange(keys.dwell, 0, -1),
      client.lrange(keys.sessionDuration, 0, -1),
    ]);

    const pageViews = Object.values(pages).reduce(
      (sum, v) => sum + Number(v),
      0,
    );
    const sessions = sessionsRaw ? Number(sessionsRaw) : 0;
    const lcpValues = lcpRaw.map(Number).filter(Number.isFinite);
    const ttfbValues = ttfbRaw.map(Number).filter(Number.isFinite);
    const dwellValues = dwellRaw.map(Number).filter(Number.isFinite);
    const sessionDurations = dedupeSessionDurations(sessionDurationRaw);

    const hasActivity =
      pageViews > 0 ||
      sessions > 0 ||
      Object.keys(clicks).length > 0 ||
      Object.keys(countries).length > 0 ||
      Object.keys(scroll).length > 0 ||
      lcpValues.length > 0 ||
      ttfbValues.length > 0 ||
      dwellValues.length > 0 ||
      sessionDurations.length > 0;

    if (hasActivity) {
      await this.metrics.upsert(
        {
          projectId,
          periodStart: new Date(period),
          periodSeconds: PERIOD_MS / 1000,
          pageViews,
          sessions,
          topPages: topEntries(pages),
          taggedClicks: topEntries(clicks),
          countries: topEntries(countries),
          scrollDepth: topEntries(scroll),
          utmSources: topEntries(utmSources),
          eventTypeCounts: topEntries(eventTypes),
          lcpP50: numOrNull(percentile(lcpValues, 50)),
          lcpP75: numOrNull(percentile(lcpValues, 75)),
          ttfbP50: numOrNull(percentile(ttfbValues, 50)),
          ttfbP75: numOrNull(percentile(ttfbValues, 75)),
          dwellAvgMs: numOrNull(average(dwellValues)),
          dwellP50: numOrNull(percentile(dwellValues, 50)),
          sessionDurationAvgMs: numOrNull(average(sessionDurations)),
          sessionDurationP50: numOrNull(percentile(sessionDurations, 50)),
        },
        ['projectId', 'periodStart'],
      );
    }

    await client.del(...Object.values(keys));
  }
}
