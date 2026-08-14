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
};

export function summary(
  projectId: string,
  days = 7,
): Promise<TelemetrySummary> {
  return request<TelemetrySummary>(
    `/tenant/projects/${encodeURIComponent(projectId)}/telemetry/summary?days=${days}`,
  );
}
