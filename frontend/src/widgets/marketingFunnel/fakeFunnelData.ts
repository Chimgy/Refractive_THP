import { mulberry32, seedFromString } from '../mockSeeded';
import {
  describeFunnelStep,
  type FunnelStep,
  type FunnelStepType,
  type MarketingFunnelConfig,
} from './config';

export type FunnelStepResult = {
  step: FunnelStep;
  label: string;
  count: number;
};

// Plausible conversion-rate range per step type — later/harder milestones
// get lower ranges. The first step in a funnel ignores this (it's the
// top-of-funnel baseline count).
const BASE_RATE_RANGE: Record<FunnelStepType, [number, number]> = {
  install: [0.5, 0.9],
  signup_login: [0.55, 0.85],
  invited_someone: [0.15, 0.4],
  created_project: [0.3, 0.6],
  linked_project: [0.4, 0.7],
  created_projects_count: [0.2, 0.5],
  clicked_feature: [0.35, 0.65],
  continued_using: [0.25, 0.55],
};

export function generateFunnelResults(
  config: Pick<MarketingFunnelConfig, 'seed' | 'utmSegment'>,
  steps: FunnelStep[],
): FunnelStepResult[] {
  const seed = seedFromString(`${config.seed}:${config.utmSegment}`);
  const rand = mulberry32(seed);
  let count = Math.round(800 + rand() * 1400);

  return steps.map((step, i) => {
    if (i > 0) {
      const [lo, hi] = BASE_RATE_RANGE[step.type];
      const rate = lo + rand() * (hi - lo);
      count = Math.max(0, Math.round(count * rate));
    }
    return { step, label: describeFunnelStep(step), count };
  });
}

export function funnelResultsToCsv(results: FunnelStepResult[]): string {
  const header = 'step,count,pct_of_first,drop_off_from_prev';
  const first = results[0]?.count ?? 0;
  const rows = results.map((r, i) => {
    const pctOfFirst = first > 0 ? ((r.count / first) * 100).toFixed(1) : '0';
    const prev = i > 0 ? results[i - 1].count : r.count;
    const dropOff =
      prev > 0 ? (((prev - r.count) / prev) * 100).toFixed(1) : '0';
    return `${r.label},${r.count},${pctOfFirst}%,${dropOff}%`;
  });
  return [header, ...rows].join('\n');
}
