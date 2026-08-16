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
  // Cold-connection DNS/TCP and cache-status-split LCP — see the backend's
  // sdk-telemetry-metric.entity.ts for what "cold"/"cached" mean here.
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
  // From a linked Cloudflare zone (edgelog_metrics) — null across the board
  // when the project has no zone linked, not fabricated.
  ttfbHitMs: number | null;
  ttfbMissMs: number | null;
  originResponseAvgMs: number | null;
  edgeLocations: TelemetryBreakdownEntry[];
};

export function summary(
  projectId: string,
  days = 7,
): Promise<TelemetrySummary> {
  return request<TelemetrySummary>(
    `/tenant/projects/${encodeURIComponent(projectId)}/telemetry/summary?days=${days}`,
  );
}
