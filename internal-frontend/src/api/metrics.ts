import { request } from './client';

export type ActiveSummary = {
  dau: number;
  wau: number;
  mau: number;
};

export type KeyCount = { key: string; count: number };

export type TodayUsage = {
  eventTypeCounts: KeyCount[];
  totalEvents: number;
  actionsPerUser: string | null;
};

export type UsageSummary = {
  users: ActiveSummary;
  teams: ActiveSummary;
  today: TodayUsage;
};

export function getUsageMetrics(): Promise<UsageSummary> {
  return request<UsageSummary>('/metrics/usage');
}
