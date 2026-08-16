import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { EdgeLogMetric } from './entities/edgelog-metric.entity';
import { SdkTelemetryMetric } from './entities/sdk-telemetry-metric.entity';

export type TelemetryDailyPoint = {
  day: string;
  views: number;
  sessions: number;
};
export type TelemetryTopPage = { path: string; views: number };
export type TelemetryTaggedClick = { tag: string; count: number };
export type TelemetryBreakdownEntry = { key: string; count: number };
export type TelemetryScrollMilestone = { depth: number; pct: number };

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
  countries: TelemetryBreakdownEntry[];
  devices: TelemetryBreakdownEntry[];
  locales: TelemetryBreakdownEntry[];
  utmSources: TelemetryBreakdownEntry[];
  scrollDepth: TelemetryScrollMilestone[];
  lcpP50: number | null;
  lcpP75: number | null;
  lcpP99: number | null;
  ttfbP50: number | null;
  ttfbP75: number | null;
  ttfbP99: number | null;
  dwellAvgMs: number | null;
  dwellP50: number | null;
  // Cold-connection DNS/TCP and cache-status-split LCP — see
  // sdk-telemetry-metric.entity.ts for what "cold" means for each.
  dnsColdP50: number | null;
  dnsColdP75: number | null;
  dnsColdP99: number | null;
  tcpColdP50: number | null;
  tcpColdP75: number | null;
  tcpColdP99: number | null;
  navColdCountries: TelemetryBreakdownEntry[];
  navReusedCountries: TelemetryBreakdownEntry[];
  lcpColdP50: number | null;
  lcpColdP75: number | null;
  lcpColdP99: number | null;
  lcpCachedP50: number | null;
  lcpCachedP75: number | null;
  lcpCachedP99: number | null;
  // Real per-visitor TTFB HIT/MISS (p75) — sourced from sdk_telemetry_metrics'
  // ttfbHitP75/ttfbMissP75 (client-measured, labeled via the Server-Timing
  // Transform Rule — see sdk-telemetry-metric.entity.ts), not from
  // edgelog_metrics: Cloudflare's GraphQL edgeTimeToFirstByteMs field turned
  // out to require a Pro plan, so that path never had real ms to give.
  ttfbHitMs: number | null;
  ttfbMissMs: number | null;
  // These two ARE from edgelog_metrics (Cloudflare zone link) — null when
  // the project has no linked zone, same "absent, not fabricated" convention
  // as every other field here. Zone-wide context the embed script can't
  // produce (origin-only latency, traffic that never ran the script).
  originResponseAvgMs: number | null;
  edgeLocations: TelemetryBreakdownEntry[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EDGELOG_CLOUDFLARE_SOURCE = 'cloudflare';

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

// Volume-weighted mean of each period's own value — Σ(value_i × count_i) /
// Σ(count_i) — instead of treating every period equally regardless of how
// many samples backed its number. A period with 3 samples no longer counts
// the same as one with 3,000. Not a true percentile-of-pooled-data (the raw
// samples themselves are gone by the time this runs — see
// telemetry-rollup.processor.ts), but a real improvement over a flat mean
// across periods.
function weightedAverage<T>(
  rows: T[],
  getValue: (row: T) => string | null,
  getCount: (row: T) => number,
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const row of rows) {
    const raw = getValue(row);
    const n = getCount(row);
    if (raw === null || !Number.isFinite(n) || n <= 0) continue;
    weightedSum += Number(raw) * n;
    totalWeight += n;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
}

function buildDailySeries(
  rows: SdkTelemetryMetric[],
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

type BreakdownField =
  | 'topPages'
  | 'taggedClicks'
  | 'countries'
  | 'scrollDepth'
  | 'utmSources'
  | 'devices'
  | 'locales'
  | 'navColdCountries'
  | 'navReusedCountries';

function mergeTopEntries(
  rows: SdkTelemetryMetric[],
  field: BreakdownField,
  limit: number,
): TelemetryBreakdownEntry[] {
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

function mergeEdgeLocations(rows: EdgeLogMetric[]): TelemetryBreakdownEntry[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const entry of row.edgeLocations) {
      totals.set(entry.key, (totals.get(entry.key) ?? 0) + entry.count);
    }
  }
  return Array.from(totals.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

const SCROLL_MILESTONES = [25, 50, 75, 100];

// Milestones as % of page views (matches the "% OF VIEWS" semantics
// MetricsPage.tsx already documents), not a top-N ranking — every milestone
// is always present, zero-filled, rather than only whichever ones happened
// to have a Redis key this window.
function buildScrollDepth(
  rows: SdkTelemetryMetric[],
  pageViews: number,
): TelemetryScrollMilestone[] {
  const totals = new Map<number, number>();
  for (const row of rows) {
    for (const entry of row.scrollDepth) {
      const depth = Number(entry.key);
      if (!SCROLL_MILESTONES.includes(depth)) continue;
      totals.set(depth, (totals.get(depth) ?? 0) + entry.count);
    }
  }
  return SCROLL_MILESTONES.map((depth) => ({
    depth,
    pct: pageViews > 0 ? ((totals.get(depth) ?? 0) / pageViews) * 100 : 0,
  }));
}

type UnweightedColumn = 'dwellAvgMs' | 'dwellP50';

// Mean of each period's own value, unweighted — kept for dwell (and
// sessionDurationAvgMs above, computed separately) since neither has a
// per-period sample-count column to weight by. Everything that does have one
// (lcp/ttfb and the new cold/cached splits) uses weightedAverage instead;
// this is a smaller, explicitly-scoped exception, not the general case
// anymore — see weightedAverage's own comment for why the unweighted version
// was worth replacing everywhere it could be.
function averageColumn(
  rows: SdkTelemetryMetric[],
  field: UnweightedColumn,
): number | null {
  return average(
    rows
      .map((r) => (r[field] !== null ? Number(r[field]) : null))
      .filter((v): v is number => v !== null),
  );
}

// Reads the pre-aggregated sdk_telemetry_metrics table (embed-script data —
// never Redis, never raw snapshots, see external_data.md section 6) plus
// edgelog_metrics (Cloudflare-sourced data, see edgelog-metric.entity.ts for
// why that's a separate table) and folds the requested window's rows into
// the shapes the dashboard actually renders. Everything here is a real
// reduction over stored rows — nothing here fabricates a number the
// underlying schema can't support (e.g. no per-page average dwell time,
// since dwell is only tracked per project+period, not per page).
@Injectable()
export class TelemetryMetricsQueryService {
  constructor(
    @InjectRepository(SdkTelemetryMetric)
    private readonly metrics: Repository<SdkTelemetryMetric>,
    @InjectRepository(EdgeLogMetric)
    private readonly edgeLogs: Repository<EdgeLogMetric>,
  ) {}

  async getSummary(projectId: string, days: number): Promise<TelemetrySummary> {
    const now = new Date();
    const rangeStart = new Date(now.getTime() - days * DAY_MS);
    const previousStart = new Date(rangeStart.getTime() - days * DAY_MS);
    const dayAgo = new Date(now.getTime() - DAY_MS);

    const [currentRows, previousRows, edgeLogRows] = await Promise.all([
      this.metrics.find({
        where: { projectId, periodStart: Between(rangeStart, now) },
        order: { periodStart: 'ASC' },
      }),
      this.metrics.find({
        where: { projectId, periodStart: Between(previousStart, rangeStart) },
      }),
      this.edgeLogs.find({
        where: {
          projectId,
          source: EDGELOG_CLOUDFLARE_SOURCE,
          periodStart: Between(rangeStart, now),
        },
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
      countries: mergeTopEntries(currentRows, 'countries', 20),
      devices: mergeTopEntries(currentRows, 'devices', 3),
      locales: mergeTopEntries(currentRows, 'locales', 8),
      utmSources: mergeTopEntries(currentRows, 'utmSources', 8),
      scrollDepth: buildScrollDepth(currentRows, pageViews),
      lcpP50: weightedAverage(currentRows, (r) => r.lcpP50, (r) => r.lcpCount),
      lcpP75: weightedAverage(currentRows, (r) => r.lcpP75, (r) => r.lcpCount),
      lcpP99: weightedAverage(currentRows, (r) => r.lcpP99, (r) => r.lcpCount),
      ttfbP50: weightedAverage(currentRows, (r) => r.ttfbP50, (r) => r.ttfbCount),
      ttfbP75: weightedAverage(currentRows, (r) => r.ttfbP75, (r) => r.ttfbCount),
      ttfbP99: weightedAverage(currentRows, (r) => r.ttfbP99, (r) => r.ttfbCount),
      dwellAvgMs: averageColumn(currentRows, 'dwellAvgMs'),
      dwellP50: averageColumn(currentRows, 'dwellP50'),
      dnsColdP50: weightedAverage(currentRows, (r) => r.dnsColdP50, (r) => r.navColdCount),
      dnsColdP75: weightedAverage(currentRows, (r) => r.dnsColdP75, (r) => r.navColdCount),
      dnsColdP99: weightedAverage(currentRows, (r) => r.dnsColdP99, (r) => r.navColdCount),
      tcpColdP50: weightedAverage(currentRows, (r) => r.tcpColdP50, (r) => r.navColdCount),
      tcpColdP75: weightedAverage(currentRows, (r) => r.tcpColdP75, (r) => r.navColdCount),
      tcpColdP99: weightedAverage(currentRows, (r) => r.tcpColdP99, (r) => r.navColdCount),
      navColdCountries: mergeTopEntries(currentRows, 'navColdCountries', 20),
      navReusedCountries: mergeTopEntries(currentRows, 'navReusedCountries', 20),
      lcpColdP50: weightedAverage(currentRows, (r) => r.lcpColdP50, (r) => r.lcpColdCount),
      lcpColdP75: weightedAverage(currentRows, (r) => r.lcpColdP75, (r) => r.lcpColdCount),
      lcpColdP99: weightedAverage(currentRows, (r) => r.lcpColdP99, (r) => r.lcpColdCount),
      lcpCachedP50: weightedAverage(currentRows, (r) => r.lcpCachedP50, (r) => r.lcpCachedCount),
      lcpCachedP75: weightedAverage(currentRows, (r) => r.lcpCachedP75, (r) => r.lcpCachedCount),
      lcpCachedP99: weightedAverage(currentRows, (r) => r.lcpCachedP99, (r) => r.lcpCachedCount),
      ttfbHitMs: weightedAverage(currentRows, (r) => r.ttfbHitP75, (r) => r.ttfbHitCount),
      ttfbMissMs: weightedAverage(currentRows, (r) => r.ttfbMissP75, (r) => r.ttfbMissCount),
      originResponseAvgMs: weightedAverage(
        edgeLogRows,
        (r) => r.originResponseAvgMs,
        (r) => r.cacheHitCount + r.cacheMissCount,
      ),
      edgeLocations: mergeEdgeLocations(edgeLogRows),
    };
  }
}
