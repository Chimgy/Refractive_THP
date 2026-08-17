import { request } from './client';

export type UniqueVisitors = {
  projectId: string;
  days: number;
  uniqueVisitors: number;
};

export function uniqueVisitors(
  projectId: string,
  days = 7,
): Promise<UniqueVisitors> {
  return request<UniqueVisitors>(
    `/tenant/projects/${encodeURIComponent(projectId)}/telemetry/uniques?days=${days}`,
  );
}

export type TelemetryBreakdownEntry = { key: string; count: number };
export type TelemetryScrollMilestone = { depth: number; pct: number };

export type TelemetrySummary = {
  projectId: string;
  days: number;
  pageViews: number;
  pageViewsDeltaPct: number | null;
  sessions: number;
  sessionsDeltaPct: number | null;
  // Despite the name, this is active session time, not wall-clock session
  // length — see the backend's sdk-telemetry-metric.entity.ts. Kept for
  // existing readers; sessionWallAvgMs below is the true wall-clock figure.
  avgSessionMs: number | null;
  avgSessionDeltaMs: number | null;
  events24h: number;
  series: { day: string; views: number; sessions: number }[];
  topPages: { path: string; views: number }[];
  taggedClicks: { tag: string; count: number }[];
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
  // Median active session time, pairs with sessionWallP50 below.
  sessionActiveP50: number | null;
  // True wall-clock session length (session_end's durationMs) — distinct
  // from avgSessionMs/sessionActiveP50 above.
  sessionWallAvgMs: number | null;
  sessionWallDeltaMs: number | null;
  sessionWallP50: number | null;
  sessionWallCount: number;
  // Fixed-order distribution: <30s, 30s-1m, 1-3m, 3-5m, 5-10m, 10m+.
  sessionWallDurationBuckets: TelemetryBreakdownEntry[];
  // Cold-connection DNS/TCP, cache-status-split LCP, and load-phase
  // milestones — see the backend's sdk-telemetry-metric.entity.ts for what
  // "cold"/"cached" mean here.
  dnsColdP50: number | null;
  dnsColdP75: number | null;
  dnsColdP99: number | null;
  tcpColdP50: number | null;
  tcpColdP75: number | null;
  tcpColdP99: number | null;
  domContentLoadedColdP50: number | null;
  loadCompleteColdP50: number | null;
  navColdCountries: TelemetryBreakdownEntry[];
  navReusedCountries: TelemetryBreakdownEntry[];
  lcpColdP50: number | null;
  lcpColdP75: number | null;
  lcpColdP99: number | null;
  lcpCachedP50: number | null;
  lcpCachedP75: number | null;
  lcpCachedP99: number | null;
  // Real per-visitor TTFB HIT/MISS, full percentile spread — client-measured
  // via the Server-Timing cache-status label, null until real visits carry
  // that header.
  ttfbHitP50: number | null;
  ttfbHitP75: number | null;
  ttfbHitP99: number | null;
  ttfbHitCount: number;
  ttfbMissP50: number | null;
  ttfbMissP75: number | null;
  ttfbMissP99: number | null;
  ttfbMissCount: number;
  originResponseAvgMs: number | null;
  edgeLocations: TelemetryBreakdownEntry[];
  cacheHitCount: number;
  cacheMissCount: number;
  status2xxCount: number;
  status3xxCount: number;
  status4xxCount: number;
  status5xxCount: number;
};

export function summary(
  projectId: string,
  days = 7,
): Promise<TelemetrySummary> {
  return request<TelemetrySummary>(
    `/tenant/projects/${encodeURIComponent(projectId)}/telemetry/summary?days=${days}`,
  );
}

export type ErrorFingerprint = {
  id: string;
  projectId: string | null;
  fingerprint: string;
  message: string;
  file: string | null;
  line: number | null;
  col: number | null;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export function listErrors(
  projectId: string,
  page = 1,
  limit = 20,
): Promise<ErrorFingerprint[]> {
  return request<ErrorFingerprint[]>(
    `/tenant/projects/${encodeURIComponent(projectId)}/telemetry/errors?page=${page}&limit=${limit}`,
  );
}

export type ErrorSnapshot = {
  id: string;
  receivedAt: string;
  device: unknown;
  events: unknown;
};

export function errorSnapshots(
  projectId: string,
  fingerprint: string,
  page = 1,
  limit = 20,
): Promise<ErrorSnapshot[]> {
  return request<ErrorSnapshot[]>(
    `/tenant/projects/${encodeURIComponent(projectId)}/telemetry/errors/${encodeURIComponent(fingerprint)}/snapshots?page=${page}&limit=${limit}`,
  );
}
