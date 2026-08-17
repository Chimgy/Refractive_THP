import type { WidgetInstance } from './grid/types';
import type { DauWauMauConfig } from './dauWauMau/config';
import type { GrowthIndicatorConfig } from './growthIndicator/config';
import type { RetentionConfig } from './retention/config';
import type { MarketingFunnelConfig } from './marketingFunnel/config';

export type DauWauMauInstance = WidgetInstance<DauWauMauConfig> & { type: 'dau_wau_mau' };
export type GrowthIndicatorInstance = WidgetInstance<GrowthIndicatorConfig> & {
  type: 'growth_indicator';
};
export type RetentionInstance = WidgetInstance<RetentionConfig> & { type: 'retention' };
export type MarketingFunnelInstance = WidgetInstance<MarketingFunnelConfig> & {
  type: 'marketing_funnel';
};

export type DashboardWidgetInstance =
  | DauWauMauInstance
  | GrowthIndicatorInstance
  | RetentionInstance
  | MarketingFunnelInstance;
