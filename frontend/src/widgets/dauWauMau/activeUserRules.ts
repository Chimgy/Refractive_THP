export type Comparator = '>=' | '<=' | '>' | '<' | '=';
export const COMPARATORS: Comparator[] = ['>=', '<=', '>', '<', '='];

export type SessionTimeUnit = 'ms' | 's' | 'min';
export const SESSION_TIME_UNITS: { value: SessionTimeUnit; label: string }[] = [
  { value: 'ms', label: 'ms' },
  { value: 's', label: 'seconds' },
  { value: 'min', label: 'minutes' },
];

export type EventType =
  | 'clicks'
  | 'page_views'
  | 'scroll_depth'
  | 'logged_in'
  | 'invited_person';

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'clicks', label: 'Clicks' },
  { value: 'page_views', label: 'Page views' },
  { value: 'scroll_depth', label: 'Scroll depth' },
  { value: 'logged_in', label: 'Logged in' },
  { value: 'invited_person', label: 'Invited a person' },
];

export type ActiveUserRule =
  | {
      id: string;
      basis: 'session_time';
      comparator: Comparator;
      value: number;
      unit: SessionTimeUnit;
    }
  | {
      id: string;
      basis: 'events';
      events: EventType[];
      comparator: Comparator;
      value: number;
    };

export type Joiner = 'AND' | 'OR';

export type ActiveUserRuleSet = {
  rules: ActiveUserRule[];
  // joiners[i] sits between rules[i] and rules[i + 1] — one shorter than rules.
  joiners: Joiner[];
};

export function defaultSessionTimeRule(id: string): ActiveUserRule {
  return { id, basis: 'session_time', comparator: '>=', value: 10, unit: 's' };
}

export function defaultEventsRule(id: string): ActiveUserRule {
  return {
    id,
    basis: 'events',
    events: ['page_views'],
    comparator: '>=',
    value: 1,
  };
}

export function defaultRuleSet(): ActiveUserRuleSet {
  return { rules: [defaultSessionTimeRule('rule-1')], joiners: [] };
}

function describeRule(rule: ActiveUserRule): string {
  if (rule.basis === 'session_time') {
    const unitLabel =
      SESSION_TIME_UNITS.find((u) => u.value === rule.unit)?.label ?? rule.unit;
    return `session time ${rule.comparator} ${rule.value} ${unitLabel}`;
  }
  const eventLabels = rule.events
    .map((e) => EVENT_TYPES.find((et) => et.value === e)?.label ?? e)
    .join(', ');
  return `events (${eventLabels || 'none selected'}) ${rule.comparator} ${rule.value}`;
}

// Renders the rule set into the modular sentence text, e.g. "Active if
// session time >= 10 seconds AND events (page views) >= 1".
export function describeRuleSet(ruleSet: ActiveUserRuleSet): string {
  if (ruleSet.rules.length === 0) return 'No rule defined yet.';
  return (
    'Active if ' +
    ruleSet.rules
      .map((rule, i) =>
        i === 0
          ? describeRule(rule)
          : ` ${ruleSet.joiners[i - 1] ?? 'AND'} ${describeRule(rule)}`,
      )
      .join('')
  );
}
