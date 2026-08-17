import { seedFromString } from '../mockSeeded';
import { registerWidget } from '../registry';
import type { RangeOption } from '../common/RangeSelect';

export const WIDGET_TYPE = 'growth_indicator' as const;

export type GrowthSegment = 'new' | 'returning' | 'dormant' | 'resurrecting';
export type Interval = 'week' | 'month';

export const INTERVAL_OPTIONS: RangeOption<Interval>[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

export type GrowthIndicatorConfig = {
  seed: number;
  interval: Interval;
  periods: number;
  dormantAfterWeeks: number;
  visibleSegments: GrowthSegment[];
};

export function defaultGrowthIndicatorConfig(
  seedInput: string,
): GrowthIndicatorConfig {
  return {
    seed: seedFromString(seedInput),
    interval: 'week',
    periods: 8,
    dormantAfterWeeks: 4,
    visibleSegments: ['new', 'returning', 'dormant', 'resurrecting'],
  };
}

registerWidget<GrowthIndicatorConfig>({
  type: WIDGET_TYPE,
  label: 'Growth Indicator',
  description: 'New, returning, dormant and resurrecting users over time.',
  minW: 4,
  minH: 6,
  maxW: 12,
  maxH: 16,
  defaultW: 5,
  defaultH: 9,
  createDefaultConfig: defaultGrowthIndicatorConfig,
});
