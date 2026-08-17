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
export const devicesKey = (projectId: string, period: string) =>
  prefix('devices', projectId, period);
export const localesKey = (projectId: string, period: string) =>
  prefix('locales', projectId, period);

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
// LCP split by navigation type (vitals.lcpCache) — additive alongside lcpKey
// above, which stays blended. Plain numeric lists, same shape as lcpKey —
// no composite-string parsing needed since there's no geo dimension here.
export const lcpColdKey = (projectId: string, period: string) =>
  prefix('lcp_cold', projectId, period);
export const lcpCachedKey = (projectId: string, period: string) =>
  prefix('lcp_cached', projectId, period);
// Cold DNS/TCP samples (vitals.tcp > 0) — entries are
// `${country}:${dns}:${tcp}:${domContentLoaded}:${loadComplete}` (the last
// two empty-string when the vitals event didn't carry them), same
// composite-string-in-one-list idiom as sessionDurationKey below, so a
// per-period key count doesn't scale with the number of countries seen.
// domContentLoaded/loadComplete are only meaningful alongside a cold nav
// (they're wall-clock-from-navigation-start milestones, and a reused
// connection's dns/tcp are near-zero by definition anyway), so they ride
// along on this key rather than getting one of their own.
export const navColdKey = (projectId: string, period: string) =>
  prefix('nav_cold', projectId, period);
// Reused connections (vitals.tcp === 0) — country-tagged counter only, no ms
// stored (near-zero by definition). Hash counter, same shape as
// countriesKey.
export const navReusedKey = (projectId: string, period: string) =>
  prefix('nav_reused', projectId, period);
// TTFB split by real cf-cache-status, read client-side via a Server-Timing
// entry a Cloudflare Transform Rule mirrors it into (vitals.ttfbCache) —
// additive alongside ttfbKey above, which stays blended. Plain numeric
// lists, same shape as lcpColdKey/lcpCachedKey.
export const ttfbHitKey = (projectId: string, period: string) =>
  prefix('ttfb_hit', projectId, period);
export const ttfbMissKey = (projectId: string, period: string) =>
  prefix('ttfb_miss', projectId, period);
// Entries are `${sessionId}:${activeMs}` (activeMs preferred over durationMs
// — see telemetry-aggregation.service.ts's session_end handling) — despite
// the key/column name, this is *active* time, not wall-clock session
// length. session_end can fire more than once per session per period
// (external_data.md section 1's documented tab-hide quirk), so rollup
// groups by sessionId and takes the max before computing a percentile over
// per-session durations, not raw fires.
export const sessionDurationKey = (projectId: string, period: string) =>
  prefix('session_duration', projectId, period);
// True wall-clock session length — `${sessionId}:${durationMs}`, same
// dedupe-by-max-per-session shape as sessionDurationKey above, but always
// populated from durationMs (Date.now() - startedAt) regardless of whether
// activeMs is present. Kept as a separate key/column rather than folded into
// sessionDurationKey so neither number silently overwrites the other.
export const sessionWallKey = (projectId: string, period: string) =>
  prefix('session_wall', projectId, period);
