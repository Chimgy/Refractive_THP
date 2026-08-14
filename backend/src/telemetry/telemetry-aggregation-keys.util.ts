// Redis-native aggregation layer (external_data.md roadmap item 8 redesign):
// the write path buckets everything into short-lived per-project,
// per-5-minute-period keys; TelemetryRollupProcessor reads a just-closed
// period, computes the real numbers, writes one `telemetry_metrics` row,
// then the period's keys are done and left to expire.
export const PERIOD_MS = 5 * 60 * 1000;
// Generous buffer over the 5-minute rollup cadence — a delayed or retried
// rollup run still finds the period's keys, without them living forever if
// a period is ever missed outright.
export const PERIOD_TTL_SECONDS = 30 * 60;

// Floors to the period boundary and returns it as a full ISO string — both
// a stable Redis key suffix and, unmodified, a valid `periodStart` value
// for the summary row (`new Date(periodKey(...))` round-trips it exactly).
export function periodKey(date: Date): string {
  return new Date(
    Math.floor(date.getTime() / PERIOD_MS) * PERIOD_MS,
  ).toISOString();
}

export function previousPeriodKey(date: Date): string {
  return periodKey(new Date(date.getTime() - PERIOD_MS));
}

const prefix = (kind: string, projectId: string, period: string) =>
  `telemetry:agg:${kind}:${projectId}:${period}`;

// Hash counters — HINCRBY per dimension value, read back via HGETALL at
// rollup.
export const pagesKey = (projectId: string, period: string) =>
  prefix('pages', projectId, period);
export const clicksKey = (projectId: string, period: string) =>
  prefix('clicks', projectId, period);
export const countriesKey = (projectId: string, period: string) =>
  prefix('countries', projectId, period);
export const scrollKey = (projectId: string, period: string) =>
  prefix('scroll', projectId, period);
export const utmSourceKey = (projectId: string, period: string) =>
  prefix('utm_source', projectId, period);
export const eventTypesKey = (projectId: string, period: string) =>
  prefix('event_types', projectId, period);

// Scalar counter — plain INCRBY.
export const sessionsKey = (projectId: string, period: string) =>
  prefix('sessions', projectId, period);

// Lists of raw samples — RPUSH per event, percentile computed in JS at
// rollup from the full list, then the key is discarded. Small enough at any
// realistic per-project 5-minute volume that this is cheaper than standing
// up a real sketch/digest structure for it.
export const lcpKey = (projectId: string, period: string) =>
  prefix('lcp', projectId, period);
export const ttfbKey = (projectId: string, period: string) =>
  prefix('ttfb', projectId, period);
export const dwellKey = (projectId: string, period: string) =>
  prefix('dwell', projectId, period);
// Entries are `${sessionId}:${durationMs}` — session_end can fire more than
// once per session per period (external_data.md section 1's documented
// tab-hide quirk), so rollup groups by sessionId and takes the max before
// computing a percentile over per-session durations, not raw fires.
export const sessionDurationKey = (projectId: string, period: string) =>
  prefix('session_duration', projectId, period);
