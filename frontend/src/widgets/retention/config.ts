import { seedFromString } from '../mockSeeded';
import { registerWidget } from '../registry';
import type { Comparator, SessionTimeUnit } from '../dauWauMau/activeUserRules';

export const WIDGET_TYPE = 'retention' as const;

export type ViewMode = 'graph' | 'table';

export type RetentionFeatureKey = 'seo_bot' | 'screen_record' | 'alert_rule';

export const RETENTION_FEATURE_OPTIONS: {
  key: RetentionFeatureKey;
  label: string;
}[] = [
  { key: 'seo_bot', label: 'SEO emulation bot used' },
  { key: 'screen_record', label: 'Screen record used' },
  { key: 'alert_rule', label: 'Alert rule created' },
];

// Mutually exclusive — pick the one behavior that counts as "retained" this
// week, rather than combining several.
export type RetentionBasis =
  | { kind: 'logged_in' }
  | {
      kind: 'stayed_on_site';
      comparator: Comparator;
      value: number;
      unit: SessionTimeUnit;
    }
  | { kind: 'feature_engagement'; feature: RetentionFeatureKey }
  | { kind: 'visited_page'; path: string };

export function defaultRetentionBasis(
  kind: RetentionBasis['kind'],
): RetentionBasis {
  switch (kind) {
    case 'logged_in':
      return { kind: 'logged_in' };
    case 'stayed_on_site':
      return {
        kind: 'stayed_on_site',
        comparator: '>=',
        value: 5,
        unit: 'min',
      };
    case 'feature_engagement':
      return { kind: 'feature_engagement', feature: 'seo_bot' };
    case 'visited_page':
      return { kind: 'visited_page', path: '/pricing' };
  }
}

// What defines a cohort row. "Weekly" (first week on the app) is the simple
// default; the other three anchor each row to a release/feature-launch/
// campaign instead of a calendar week — the columns are still "weeks since"
// whatever that row's anchor is.
export type CohortType =
  'weekly_signup' | 'release' | 'feature_launch' | 'marketing_campaign';

export const COHORT_TYPE_OPTIONS: { value: CohortType; label: string }[] = [
  { value: 'weekly_signup', label: 'Weekly (first week on the app)' },
  { value: 'release', label: 'Deployment release' },
  { value: 'feature_launch', label: 'Feature launch' },
  { value: 'marketing_campaign', label: 'Marketing campaign' },
];

// No real release/feature/campaign data exists yet — fixed fake entity
// lists, same "fake data for UI presentation only" constraint as elsewhere.
export const RELEASE_NAMES = ['v2.1', 'v2.2', 'v2.3', 'v2.4'];
export const FEATURE_NAMES = [
  'dashboards',
  'exports',
  'invites',
  'integrations',
];
export const CAMPAIGN_NAMES = ['Campaign A', 'Campaign B', 'Campaign C'];

export function entityNamesFor(cohortType: CohortType): string[] {
  switch (cohortType) {
    case 'release':
      return RELEASE_NAMES;
    case 'feature_launch':
      return FEATURE_NAMES;
    case 'marketing_campaign':
      return CAMPAIGN_NAMES;
    case 'weekly_signup':
      return [];
  }
}

export type RetentionConfig = {
  seed: number;
  cohortWeeks: number;
  cohortType: CohortType;
  // Which releases/features/campaigns show as rows — ignored for
  // weekly_signup. Empty means "all" only until the editor first touches
  // cohortType, which fills it with the full list for that type.
  selectedEntities: string[];
  retentionBasis: RetentionBasis;
  viewMode: ViewMode;
};

export function defaultRetentionConfig(seedInput: string): RetentionConfig {
  return {
    seed: seedFromString(seedInput),
    cohortWeeks: 10,
    cohortType: 'weekly_signup',
    selectedEntities: [],
    retentionBasis: defaultRetentionBasis('logged_in'),
    viewMode: 'table',
  };
}

registerWidget<RetentionConfig>({
  type: WIDGET_TYPE,
  label: 'Retention',
  description: 'Cohort retention — who kept coming back.',
  minW: 5,
  minH: 7,
  maxW: 12,
  maxH: 18,
  defaultW: 6,
  defaultH: 10,
  createDefaultConfig: defaultRetentionConfig,
});
