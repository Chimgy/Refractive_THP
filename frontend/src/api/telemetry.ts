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
