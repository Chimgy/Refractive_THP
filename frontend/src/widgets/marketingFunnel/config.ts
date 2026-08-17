import { seedFromString } from '../mockSeeded';
import { registerWidget } from '../registry';
import type { RangeOption } from '../common/RangeSelect';

export const WIDGET_TYPE = 'marketing_funnel' as const;

export type FunnelStepType =
  | 'install'
  | 'signup_login'
  | 'invited_someone'
  | 'created_project'
  | 'linked_project'
  | 'created_projects_count'
  | 'clicked_feature'
  | 'continued_using';

export const FUNNEL_STEP_TYPE_OPTIONS: { value: FunnelStepType; label: string }[] = [
  { value: 'install', label: 'Installed' },
  { value: 'signup_login', label: 'Signed up / logged in' },
  { value: 'invited_someone', label: 'Invited someone' },
  { value: 'created_project', label: 'Created a project' },
  { value: 'linked_project', label: 'Linked a project' },
  { value: 'created_projects_count', label: 'Created ≥ N projects' },
  { value: 'clicked_feature', label: 'Clicked a feature' },
  { value: 'continued_using', label: 'Continued using for N days' },
];

export const FEATURE_OPTIONS = ['dashboards', 'exports', 'invites', 'integrations'];

export const UTM_SEGMENT_OPTIONS: RangeOption<string>[] = [
  { value: 'all', label: 'All traffic' },
  { value: 'linkedin', label: 'linkedin' },
  { value: 'newsletter', label: 'newsletter' },
  { value: 'google', label: 'google' },
  { value: 'direct', label: 'direct' },
];

export type FunnelStep = {
  id: string;
  type: FunnelStepType;
  threshold?: number;
  featureKey?: string;
};

export type MarketingFunnelConfig = {
  seed: number;
  steps: FunnelStep[];
  utmSegment: string;
};

export function defaultFunnelStep(id: string, type: FunnelStepType = 'signup_login'): FunnelStep {
  const step: FunnelStep = { id, type };
  if (type === 'created_projects_count') step.threshold = 3;
  if (type === 'continued_using') step.threshold = 14;
  if (type === 'clicked_feature') step.featureKey = FEATURE_OPTIONS[0];
  return step;
}

export function describeFunnelStep(step: FunnelStep): string {
  switch (step.type) {
    case 'install':
      return 'Installed';
    case 'signup_login':
      return 'Signed up / logged in';
    case 'invited_someone':
      return 'Invited someone';
    case 'created_project':
      return 'Created a project';
    case 'linked_project':
      return 'Linked a project';
    case 'created_projects_count':
      return `Created ≥ ${step.threshold ?? 1} projects`;
    case 'clicked_feature':
      return `Clicked "${step.featureKey ?? 'a feature'}"`;
    case 'continued_using':
      return `Continued using for ${step.threshold ?? 7}+ days`;
  }
}

export function defaultMarketingFunnelConfig(seedInput: string): MarketingFunnelConfig {
  return {
    seed: seedFromString(seedInput),
    steps: [
      defaultFunnelStep('step-1', 'install'),
      defaultFunnelStep('step-2', 'signup_login'),
      defaultFunnelStep('step-3', 'invited_someone'),
    ],
    utmSegment: 'all',
  };
}

registerWidget<MarketingFunnelConfig>({
  type: WIDGET_TYPE,
  label: 'Marketing Funnel',
  description: 'Conversion through a user-defined sequence of milestones.',
  minW: 5,
  minH: 6,
  maxW: 12,
  maxH: 24,
  defaultW: 6,
  defaultH: 10,
  createDefaultConfig: defaultMarketingFunnelConfig,
});
