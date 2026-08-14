import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { TelemetryMetric } from './entities/telemetry-metric.entity';

export type TelemetryDailyPoint = {
  day: string;
  views: number;
  sessions: number;
};
export type TelemetryTopPage = { path: string; views: number };
export type TelemetryTaggedClick = { tag: string; count: number };

export type TelemetrySummary = {
  projectId: string;
  days: number;
  pageViews: number;
  pageViewsDeltaPct: number | null;
  sessions: number;
  sessionsDeltaPct: number | null;
  avgSessionMs: number | null;
  avgSessionDeltaMs: number | null;
  events24h: number;
  series: TelemetryDailyPoint[];
  topPages: TelemetryTopPage[];
  taggedClicks: TelemetryTaggedClick[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const sumBy = <T>(items: T[], fn: (item: T) => number): number =>
  items.reduce((sum, item) => sum + fn(item), 0);

const sumBucket = (bucket: { key: string; count: number }[]): number =>
  bucket.reduce((sum, entry) => sum + entry.count, 0);

// null means "no comparable baseline" (previous period was zero) rather than
// a fabricated infinite/zero percentage — the frontend renders that as
// "vs prev period" with no arrow instead of a misleading number.
function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
}

function buildDailySeries(
  rows: TelemetryMetric[],
  days: number,
  now: Date,
): TelemetryDailyPoint[] {
  const buckets = new Map<string, { views: number; sessions: number }>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(now.getTime() - i * DAY_MS)), {
      views: 0,
      sessions: 0,
    });
  }
  for (const row of rows) {
    const bucket = buckets.get(dayKey(row.periodStart));
    if (!bucket) continue; // period falls outside the requested window
    bucket.views += row.pageViews;
    bucket.sessions += row.sessions;
  }
  return Array.from(buckets.entries()).map(([key, v]) => ({
    day: dayLabel(key),
    views: v.views,
    sessions: v.sessions,
  }));
}

function mergeTopEntries(
  rows: TelemetryMetric[],
  field: 'topPages' | 'taggedClicks',
  limit: number,
): { key: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const entry of row[field]) {
      totals.set(entry.key, (totals.get(entry.key) ?? 0) + entry.count);
    }
  }
  return Array.from(totals.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Reads the pre-aggregated telemetry_metrics table (never Redis, never raw
// snapshots — see external_data.md section 6) and folds the requested
// window's 5-minute rows into the shapes the dashboard actually renders.
// Everything here is a real reduction over stored rows — nothing here
// fabricates a number the underlying schema can't support (e.g. no
// per-page average dwell time, since dwell is only tracked per project+
// period, not per page).
@Injectable()
export class TelemetryMetricsQueryService {
  constructor(
    @InjectRepository(TelemetryMetric)
    private readonly metrics: Repository<TelemetryMetric>,
  ) {}

  async getSummary(projectId: string, days: number): Promise<TelemetrySummary> {
    const now = new Date();
    const rangeStart = new Date(now.getTime() - days * DAY_MS);
    const previousStart = new Date(rangeStart.getTime() - days * DAY_MS);
    const dayAgo = new Date(now.getTime() - DAY_MS);

    const [currentRows, previousRows] = await Promise.all([
      this.metrics.find({
        where: { projectId, periodStart: Between(rangeStart, now) },
        order: { periodStart: 'ASC' },
      }),
      this.metrics.find({
        where: { projectId, periodStart: Between(previousStart, rangeStart) },
      }),
    ]);

    const pageViews = sumBy(currentRows, (r) => r.pageViews);
    const sessions = sumBy(currentRows, (r) => r.sessions);
    const previousPageViews = sumBy(previousRows, (r) => r.pageViews);
    const previousSessions = sumBy(previousRows, (r) => r.sessions);

    const events24h = sumBy(
      currentRows.filter((r) => r.periodStart >= dayAgo),
      (r) => sumBucket(r.eventTypeCounts),
    );

    const avgSessionMs = average(
      currentRows
        .map((r) =>
          r.sessionDurationAvgMs !== null
            ? Number(r.sessionDurationAvgMs)
            : null,
        )
        .filter((v): v is number => v !== null),
    );
    const previousAvgSessionMs = average(
      previousRows
        .map((r) =>
          r.sessionDurationAvgMs !== null
            ? Number(r.sessionDurationAvgMs)
            : null,
        )
        .filter((v): v is number => v !== null),
    );

    return {
      projectId,
      days,
      pageViews,
      pageViewsDeltaPct: pctDelta(pageViews, previousPageViews),
      sessions,
      sessionsDeltaPct: pctDelta(sessions, previousSessions),
      avgSessionMs,
      avgSessionDeltaMs:
        avgSessionMs !== null && previousAvgSessionMs !== null
          ? avgSessionMs - previousAvgSessionMs
          : null,
      events24h,
      series: buildDailySeries(currentRows, days, now),
      topPages: mergeTopEntries(currentRows, 'topPages', 5).map((e) => ({
        path: e.key,
        views: e.count,
      })),
      taggedClicks: mergeTopEntries(currentRows, 'taggedClicks', 4).map(
        (e) => ({
          tag: e.key,
          count: e.count,
        }),
      ),
    };
  }
}
