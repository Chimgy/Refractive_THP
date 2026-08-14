// HyperLogLog key, not a hash — PFADD-only, read via PFCOUNT. Daily-bucketed
// (unlike the 5-minute-period keys in telemetry-aggregation-keys.util.ts):
// merging across days via PFCOUNT's multi-key union is exactly what HLL is
// for, and uniques don't need percentile-style rollup the way vitals/dwell
// do, so this one stayed on its original design rather than moving into the
// new aggregation layer.
export const uniqueVisitorsCounterKey = (
  projectId: string,
  date: string,
): string => `telemetry:uniques:${projectId}:${date}`;
