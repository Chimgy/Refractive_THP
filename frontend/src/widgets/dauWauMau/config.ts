import { seedFromString } from '../mockSeeded';
import { registerWidget } from '../registry';
import type { RangeOption } from '../common/RangeSelect';
import { defaultRuleSet, type ActiveUserRuleSet } from './activeUserRules';

export const WIDGET_TYPE = 'dau_wau_mau' as const;

export type SeriesKey = 'dau' | 'wau' | 'mau';

export const RANGE_OPTIONS: RangeOption<number>[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export type DauWauMauConfig = {
  seed: number;
  days: number;
  visibleSeries: SeriesKey[];
  ruleSet: ActiveUserRuleSet;
};

export function defaultDauWauMauConfig(seedInput: string): DauWauMauConfig {
  return {
    seed: seedFromString(seedInput),
    days: 7,
    visibleSeries: ['dau', 'wau'],
    ruleSet: defaultRuleSet(),
  };
}

registerWidget<DauWauMauConfig>({
  type: WIDGET_TYPE,
  label: 'DAU / WAU / MAU',
  description: 'Daily, weekly and monthly active users over time.',
  minW: 4,
  minH: 6,
  maxW: 12,
  maxH: 16,
  defaultW: 7,
  defaultH: 9,
  createDefaultConfig: defaultDauWauMauConfig,
});
