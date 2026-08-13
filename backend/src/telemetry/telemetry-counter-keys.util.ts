export const pageViewCounterKey = (projectId: string, date: string): string =>
  `telemetry:pages:${projectId}:${date}`;

export const clickCounterKey = (projectId: string, date: string): string =>
  `telemetry:clicks:${projectId}:${date}`;

// HyperLogLog key, not a hash — PFADD-only, read via PFCOUNT.
export const uniqueVisitorsCounterKey = (
  projectId: string,
  date: string,
): string => `telemetry:uniques:${projectId}:${date}`;

export const countryCounterKey = (projectId: string, date: string): string =>
  `telemetry:countries:${projectId}:${date}`;
