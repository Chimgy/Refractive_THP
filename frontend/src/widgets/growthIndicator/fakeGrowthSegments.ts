import { mulberry32 } from '../mockSeeded';
import type { GrowthIndicatorConfig } from './config';

export type GrowthPoint = {
  label: string;
  new: number;
  returning: number;
  dormant: number;
  resurrecting: number;
};

function periodLabel(
  interval: 'week' | 'month',
  indexFromStart: number,
  periods: number,
): string {
  const stepsFromToday = periods - 1 - indexFromStart;
  const date = new Date();
  if (interval === 'week') {
    date.setDate(date.getDate() - stepsFromToday * 7);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
  date.setMonth(date.getMonth() - stepsFromToday);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit',
  });
}

// Every user is bucketed into exactly one state each period: new (first
// period on site), returning (active, not new — the usual majority),
// dormant (hasn't been active since dormantAfterWeeks), or resurrecting
// (was dormant, is active again). Simulated as a running population rather
// than independent per-period draws, so the dormant pool accumulates and
// resurrecting draws from it the way a real cohort would.
export function generateGrowthSegments(
  config: Pick<
    GrowthIndicatorConfig,
    'seed' | 'interval' | 'periods' | 'dormantAfterWeeks'
  >,
): GrowthPoint[] {
  const { seed, interval, periods, dormantAfterWeeks } = config;
  const rand = mulberry32(seed);

  let totalSignups = 400 + rand() * 300;
  let dormantPool = totalSignups * (0.15 + rand() * 0.1);
  const dormantRate = Math.min(0.05, 0.06 / Math.max(1, dormantAfterWeeks));

  const points: GrowthPoint[] = [];
  for (let i = 0; i < periods; i++) {
    const newCount = Math.round(30 + rand() * 60 + i * 1.5);
    totalSignups += newCount;

    const resurrectingCount = Math.round(dormantPool * (0.03 + rand() * 0.05));
    dormantPool = Math.max(0, dormantPool - resurrectingCount);

    const nonDormantBase = Math.max(1, totalSignups - dormantPool);
    const returningCount = Math.round(nonDormantBase * (0.35 + rand() * 0.15));

    const newlyDormant = Math.round(
      nonDormantBase * (dormantRate * (0.6 + rand() * 0.8)),
    );
    dormantPool += newlyDormant;

    points.push({
      label: periodLabel(interval, i, periods),
      new: newCount,
      returning: returningCount,
      dormant: Math.round(dormantPool),
      resurrecting: resurrectingCount,
    });
  }
  return points;
}

export function growthSegmentsToCsv(points: GrowthPoint[]): string {
  const header = 'period,new,returning,dormant,resurrecting';
  const rows = points.map(
    (p) => `${p.label},${p.new},${p.returning},${p.dormant},${p.resurrecting}`,
  );
  return [header, ...rows].join('\n');
}
