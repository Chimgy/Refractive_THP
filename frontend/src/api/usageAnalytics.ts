import { request } from './client';

// Mirrors backend/src/usage-analytics/entities/usage-event.entity.ts'
// UsageEventType — redefined here rather than shared, same as api/auth.ts
// already redefines UserRole locally.
export type UsageEventType =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'feature_used'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_abandoned'
  | 'error_encountered';

// First-party product-analytics capture — internal telemetry pipeline
// (see project docs), NOT the public /telemetry pipeline THP_analytics.js
// uses for third-party sites. Fire-and-forget by design: a tracking call
// must never block or break the feature it's observing, so callers should
// not await this — errors are swallowed here, not surfaced to the UI.
export function trackEvent(
  eventType: UsageEventType,
  eventName: string,
  options: { route?: string; metadata?: Record<string, unknown> } = {},
): void {
  request<void>('/tenant/usage-events', {
    method: 'POST',
    body: {
      events: [
        {
          eventType,
          eventName,
          route: options.route,
          metadata: options.metadata,
        },
      ],
    },
  }).catch(() => {
    // Best-effort — a dropped analytics event is never worth surfacing to
    // the user or retrying (matches the public telemetry endpoint's own
    // "always 204, log server-side only" philosophy, one level up the stack).
  });
}
