import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { RedisService } from '../redis/redis.service';
import { SdkTelemetryMetric } from './entities/sdk-telemetry-metric.entity';
import {
  PERIOD_MS,
  clicksKey,
  countriesKey,
  devicesKey,
  dwellKey,
  eventTypesKey,
  lcpCachedKey,
  lcpColdKey,
  lcpKey,
  localesKey,
  navColdKey,
  navReusedKey,
  pagesKey,
  previousPeriodKey,
  scrollKey,
  sessionDurationKey,
  sessionsKey,
  sessionWallKey,
  ttfbHitKey,
  ttfbKey,
  ttfbMissKey,
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

// Same shape as topEntries above, but counting an in-memory array instead of
// reading a Redis hash — used for navColdCountries, which is derived from
// navColdKey's parsed composite-string samples rather than its own hash key
// (see navColdKey's own comment for why cold samples are one list, not one
// hash field per country).
function countEntries(values: string[], limit = 20): Bucket {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
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

type ColdNavSample = {
  country: string;
  dns: number;
  tcp: number;
  domContentLoaded: number | null;
  loadComplete: number | null;
};

// navColdKey entries are
// `${country}:${dns}:${tcp}:${domContentLoaded}:${loadComplete}` — no
// session-style dedup needed here (unlike session durations above), every
// sample is independent, just parsed apart into its five fields. The last
// two are '' (parsed to null) when the vitals event didn't carry them.
function parseColdNavSamples(entries: string[]): ColdNavSample[] {
  const samples: ColdNavSample[] = [];
  for (const entry of entries) {
    const parts = entry.split(':');
    if (parts.length !== 5) continue;
    const [country, dnsRaw, tcpRaw, domRaw, loadRaw] = parts;
    const dns = Number(dnsRaw);
    const tcp = Number(tcpRaw);
    if (!Number.isFinite(dns) || !Number.isFinite(tcp)) continue;
    const domContentLoaded = domRaw !== '' ? Number(domRaw) : null;
    const loadComplete = loadRaw !== '' ? Number(loadRaw) : null;
    samples.push({
      country,
      dns,
      tcp,
      domContentLoaded:
        domContentLoaded !== null && Number.isFinite(domContentLoaded)
          ? domContentLoaded
          : null,
      loadComplete:
        loadComplete !== null && Number.isFinite(loadComplete)
          ? loadComplete
          : null,
    });
  }
  return samples;
}

const numOrNull = (n: number | null): string | null => n?.toString() ?? null;

// Fixed buckets for the session-duration histogram widget — ordered, not
// sorted by count, so the chart always reads left-to-right as "shorter to
// longer" regardless of which buckets actually have samples this window.
const SESSION_WALL_DURATION_BUCKETS: { key: string; maxMs: number }[] = [
  { key: '<30s', maxMs: 30_000 },
  { key: '30s-1m', maxMs: 60_000 },
  { key: '1-3m', maxMs: 3 * 60_000 },
  { key: '3-5m', maxMs: 5 * 60_000 },
  { key: '5-10m', maxMs: 10 * 60_000 },
  { key: '10m+', maxMs: Infinity },
];

function bucketSessionWallDurations(
  values: number[],
): { key: string; count: number }[] {
  const counts = new Map(
    SESSION_WALL_DURATION_BUCKETS.map((b) => [b.key, 0]),
  );
  for (const v of values) {
    const bucket = SESSION_WALL_DURATION_BUCKETS.find((b) => v <= b.maxMs);
    if (bucket) counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
  }
  return SESSION_WALL_DURATION_BUCKETS.map((b) => ({
    key: b.key,
    count: counts.get(b.key) ?? 0,
  }));
}

// The metrics engine (external_data.md roadmap item 8 redesign): on a
// 5-minute cadence, reads the just-closed period's Redis aggregate keys for
// every project, computes real numbers — including actual percentiles via
// the raw-sample lists, not just means from a sum/count pair — and writes
// one SdkTelemetryMetric row per project+period. The dashboard reads only
// that table, never Redis or raw events directly. Consumed keys are deleted
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
    @InjectRepository(SdkTelemetryMetric)
    private readonly metrics: Repository<SdkTelemetryMetric>,
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
      devices: devicesKey(projectId, period),
      locales: localesKey(projectId, period),
      sessions: sessionsKey(projectId, period),
      lcp: lcpKey(projectId, period),
      ttfb: ttfbKey(projectId, period),
      dwell: dwellKey(projectId, period),
      sessionDuration: sessionDurationKey(projectId, period),
      sessionWall: sessionWallKey(projectId, period),
      lcpCold: lcpColdKey(projectId, period),
      lcpCached: lcpCachedKey(projectId, period),
      navCold: navColdKey(projectId, period),
      navReused: navReusedKey(projectId, period),
      ttfbHit: ttfbHitKey(projectId, period),
      ttfbMiss: ttfbMissKey(projectId, period),
    };

    const [
      pages,
      clicks,
      countries,
      scroll,
      utmSources,
      eventTypes,
      devices,
      locales,
      sessionsRaw,
      lcpRaw,
      ttfbRaw,
      dwellRaw,
      sessionDurationRaw,
      sessionWallRaw,
      lcpColdRaw,
      lcpCachedRaw,
      navColdRaw,
      navReused,
      ttfbHitRaw,
      ttfbMissRaw,
    ] = await Promise.all([
      client.hgetall(keys.pages),
      client.hgetall(keys.clicks),
      client.hgetall(keys.countries),
      client.hgetall(keys.scroll),
      client.hgetall(keys.utmSources),
      client.hgetall(keys.eventTypes),
      client.hgetall(keys.devices),
      client.hgetall(keys.locales),
      client.get(keys.sessions),
      client.lrange(keys.lcp, 0, -1),
      client.lrange(keys.ttfb, 0, -1),
      client.lrange(keys.dwell, 0, -1),
      client.lrange(keys.sessionDuration, 0, -1),
      client.lrange(keys.sessionWall, 0, -1),
      client.lrange(keys.lcpCold, 0, -1),
      client.lrange(keys.lcpCached, 0, -1),
      client.lrange(keys.navCold, 0, -1),
      client.hgetall(keys.navReused),
      client.lrange(keys.ttfbHit, 0, -1),
      client.lrange(keys.ttfbMiss, 0, -1),
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
    const sessionWallDurations = dedupeSessionDurations(sessionWallRaw);
    const lcpColdValues = lcpColdRaw.map(Number).filter(Number.isFinite);
    const lcpCachedValues = lcpCachedRaw.map(Number).filter(Number.isFinite);
    const coldNavSamples = parseColdNavSamples(navColdRaw);
    const dnsColdValues = coldNavSamples.map((s) => s.dns);
    const tcpColdValues = coldNavSamples.map((s) => s.tcp);
    const domContentLoadedColdValues = coldNavSamples
      .map((s) => s.domContentLoaded)
      .filter((v): v is number => v !== null);
    const loadCompleteColdValues = coldNavSamples
      .map((s) => s.loadComplete)
      .filter((v): v is number => v !== null);
    const ttfbHitValues = ttfbHitRaw.map(Number).filter(Number.isFinite);
    const ttfbMissValues = ttfbMissRaw.map(Number).filter(Number.isFinite);

    const hasActivity =
      pageViews > 0 ||
      sessions > 0 ||
      Object.keys(clicks).length > 0 ||
      Object.keys(countries).length > 0 ||
      Object.keys(scroll).length > 0 ||
      Object.keys(devices).length > 0 ||
      Object.keys(locales).length > 0 ||
      lcpValues.length > 0 ||
      ttfbValues.length > 0 ||
      dwellValues.length > 0 ||
      sessionDurations.length > 0 ||
      sessionWallDurations.length > 0 ||
      lcpColdValues.length > 0 ||
      lcpCachedValues.length > 0 ||
      coldNavSamples.length > 0 ||
      Object.keys(navReused).length > 0 ||
      ttfbHitValues.length > 0 ||
      ttfbMissValues.length > 0;

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
          devices: topEntries(devices),
          locales: topEntries(locales),
          lcpP50: numOrNull(percentile(lcpValues, 50)),
          lcpP75: numOrNull(percentile(lcpValues, 75)),
          lcpP99: numOrNull(percentile(lcpValues, 99)),
          lcpCount: lcpValues.length,
          ttfbP50: numOrNull(percentile(ttfbValues, 50)),
          ttfbP75: numOrNull(percentile(ttfbValues, 75)),
          ttfbP99: numOrNull(percentile(ttfbValues, 99)),
          ttfbCount: ttfbValues.length,
          dwellAvgMs: numOrNull(average(dwellValues)),
          dwellP50: numOrNull(percentile(dwellValues, 50)),
          sessionDurationAvgMs: numOrNull(average(sessionDurations)),
          sessionDurationP50: numOrNull(percentile(sessionDurations, 50)),
          sessionWallAvgMs: numOrNull(average(sessionWallDurations)),
          sessionWallP50: numOrNull(percentile(sessionWallDurations, 50)),
          sessionWallCount: sessionWallDurations.length,
          sessionWallDurationBuckets: bucketSessionWallDurations(
            sessionWallDurations,
          ),
          domContentLoadedColdP50: numOrNull(
            percentile(domContentLoadedColdValues, 50),
          ),
          loadCompleteColdP50: numOrNull(
            percentile(loadCompleteColdValues, 50),
          ),
          dnsColdP50: numOrNull(percentile(dnsColdValues, 50)),
          dnsColdP75: numOrNull(percentile(dnsColdValues, 75)),
          dnsColdP99: numOrNull(percentile(dnsColdValues, 99)),
          tcpColdP50: numOrNull(percentile(tcpColdValues, 50)),
          tcpColdP75: numOrNull(percentile(tcpColdValues, 75)),
          tcpColdP99: numOrNull(percentile(tcpColdValues, 99)),
          navColdCount: coldNavSamples.length,
          navColdCountries: countEntries(
            coldNavSamples.map((s) => s.country),
          ),
          navReusedCountries: topEntries(navReused),
          lcpColdP50: numOrNull(percentile(lcpColdValues, 50)),
          lcpColdP75: numOrNull(percentile(lcpColdValues, 75)),
          lcpColdP99: numOrNull(percentile(lcpColdValues, 99)),
          lcpColdCount: lcpColdValues.length,
          lcpCachedP50: numOrNull(percentile(lcpCachedValues, 50)),
          lcpCachedP75: numOrNull(percentile(lcpCachedValues, 75)),
          lcpCachedP99: numOrNull(percentile(lcpCachedValues, 99)),
          lcpCachedCount: lcpCachedValues.length,
          ttfbHitP50: numOrNull(percentile(ttfbHitValues, 50)),
          ttfbHitP75: numOrNull(percentile(ttfbHitValues, 75)),
          ttfbHitP99: numOrNull(percentile(ttfbHitValues, 99)),
          ttfbHitCount: ttfbHitValues.length,
          ttfbMissP50: numOrNull(percentile(ttfbMissValues, 50)),
          ttfbMissP75: numOrNull(percentile(ttfbMissValues, 75)),
          ttfbMissP99: numOrNull(percentile(ttfbMissValues, 99)),
          ttfbMissCount: ttfbMissValues.length,
        },
        ['projectId', 'periodStart'],
      );
    }

    await client.del(...Object.values(keys));
  }
}
