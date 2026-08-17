import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COMPARATORS,
  EVENT_TYPES,
  SESSION_TIME_UNITS,
  defaultEventsRule,
  defaultSessionTimeRule,
  describeRuleSet,
  type ActiveUserRule,
  type ActiveUserRuleSet,
  type Comparator,
  type EventType,
  type Joiner,
  type SessionTimeUnit,
} from './activeUserRules';
import type { SeriesKey } from './config';

const SERIES_OPTIONS: { key: SeriesKey; label: string }[] = [
  { key: 'dau', label: 'Daily (DAU)' },
  { key: 'wau', label: 'Weekly (WAU)' },
  { key: 'mau', label: 'Monthly (MAU)' },
];

type Props = {
  ruleSet: ActiveUserRuleSet;
  visibleSeries: SeriesKey[];
  onCancel: () => void;
  onSave: (next: { ruleSet: ActiveUserRuleSet; visibleSeries: SeriesKey[] }) => void;
};

let ruleIdCounter = 0;
function nextRuleId(): string {
  ruleIdCounter += 1;
  return `rule-${Date.now()}-${ruleIdCounter}`;
}

export default function ActiveUserRuleEditor({
  ruleSet,
  visibleSeries,
  onCancel,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<ActiveUserRuleSet>(ruleSet);
  const [draftSeries, setDraftSeries] = useState<SeriesKey[]>(visibleSeries);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const preview = useMemo(() => describeRuleSet(draft), [draft]);

  const toggleSeries = useCallback((key: SeriesKey) => {
    setDraftSeries((prev) => {
      if (prev.includes(key)) {
        // Always leave at least one series on the graph.
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }, []);

  const updateRule = useCallback((id: string, next: ActiveUserRule) => {
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((r) => (r.id === id ? next : r)),
    }));
  }, []);

  const setBasis = useCallback(
    (id: string, basis: ActiveUserRule['basis']) => {
      setDraft((d) => ({
        ...d,
        rules: d.rules.map((r) =>
          r.id === id
            ? basis === 'session_time'
              ? defaultSessionTimeRule(id)
              : defaultEventsRule(id)
            : r,
        ),
      }));
    },
    [],
  );

  const addRule = useCallback(() => {
    setDraft((d) => ({
      rules: [...d.rules, defaultEventsRule(nextRuleId())],
      joiners: d.rules.length > 0 ? [...d.joiners, 'AND'] : d.joiners,
    }));
  }, []);

  const removeRule = useCallback((id: string) => {
    setDraft((d) => {
      const index = d.rules.findIndex((r) => r.id === id);
      if (index === -1) return d;
      const rules = d.rules.filter((r) => r.id !== id);
      const joiners = d.joiners.filter((_, i) => i !== Math.max(0, index - 1));
      return { rules, joiners };
    });
  }, []);

  const setJoiner = useCallback((index: number, joiner: Joiner) => {
    setDraft((d) => ({
      ...d,
      joiners: d.joiners.map((j, i) => (i === index ? joiner : j)),
    }));
  }, []);

  const handleSave = useCallback(
    () => onSave({ ruleSet: draft, visibleSeries: draftSeries }),
    [draft, draftSeries, onSave],
  );

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="panel modal-panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span className="card-title">Edit widget</span>
          <div className="mono faint" style={{ marginTop: 4, fontSize: 10.5 }}>
            Choose which series appear on the graph, and how "active" is
            defined.
          </div>
        </div>

        <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
          <div className="label">Series shown on graph</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {SERIES_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`toggle-pill ${draftSeries.includes(s.key) ? 'toggle-pill-on' : ''}`}
                onClick={() => toggleSeries(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="label" style={{ marginTop: 20 }}>
            Active user definition
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
            {draft.rules.map((rule, i) => (
              <div key={rule.id}>
                {i > 0 && (
                  <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
                    {(['AND', 'OR'] as Joiner[]).map((j) => (
                      <button
                        key={j}
                        type="button"
                        className={`toggle-pill ${draft.joiners[i - 1] === j ? 'toggle-pill-on' : ''}`}
                        onClick={() => setJoiner(i - 1, j)}
                      >
                        {j}
                      </button>
                    ))}
                  </div>
                )}
                <RuleRow
                  rule={rule}
                  canRemove={draft.rules.length > 1}
                  onChange={(next) => updateRule(rule.id, next)}
                  onBasisChange={(basis) => setBasis(rule.id, basis)}
                  onRemove={() => removeRule(rule.id)}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn"
            style={{ marginTop: 16, height: 30, fontSize: 11.5 }}
            onClick={addRule}
          >
            + Add rule
          </button>

          <div
            className="note"
            style={{ marginTop: 18, fontSize: 11.5, lineHeight: 1.6 }}
          >
            {preview}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  canRemove,
  onChange,
  onBasisChange,
  onRemove,
}: {
  rule: ActiveUserRule;
  canRemove: boolean;
  onChange: (next: ActiveUserRule) => void;
  onBasisChange: (basis: ActiveUserRule['basis']) => void;
  onRemove: () => void;
}) {
  const toggleEvent = useCallback(
    (event: EventType) => {
      if (rule.basis !== 'events') return;
      const has = rule.events.includes(event);
      const events = has
        ? rule.events.filter((e) => e !== event)
        : [...rule.events, event];
      onChange({ ...rule, events });
    },
    [rule, onChange],
  );

  return (
    <div
      className="dashed"
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          className="mono faint"
          style={{ fontSize: 10, textTransform: 'uppercase' }}
        >
          Active if
        </span>
        <select
          className="select"
          value={rule.basis}
          onChange={(e) =>
            onBasisChange(e.target.value as ActiveUserRule['basis'])
          }
        >
          <option value="session_time">session time</option>
          <option value="events">events</option>
        </select>
        {canRemove && (
          <button
            type="button"
            className="link-btn"
            style={{ marginLeft: 'auto', fontSize: 11 }}
            onClick={onRemove}
          >
            remove
          </button>
        )}
      </div>

      {rule.basis === 'session_time' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            className="select"
            value={rule.comparator}
            onChange={(e) =>
              onChange({ ...rule, comparator: e.target.value as Comparator })
            }
          >
            {COMPARATORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="input-compact"
            type="number"
            min={0}
            style={{ width: 90 }}
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
          />
          <select
            className="select"
            value={rule.unit}
            onChange={(e) =>
              onChange({ ...rule, unit: e.target.value as SessionTimeUnit })
            }
          >
            {SESSION_TIME_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EVENT_TYPES.map((et) => (
              <button
                key={et.value}
                type="button"
                className={`toggle-pill ${rule.events.includes(et.value) ? 'toggle-pill-on' : ''}`}
                onClick={() => toggleEvent(et.value)}
              >
                {et.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="select"
              value={rule.comparator}
              onChange={(e) =>
                onChange({ ...rule, comparator: e.target.value as Comparator })
              }
            >
              {COMPARATORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="input-compact"
              type="number"
              min={0}
              style={{ width: 90 }}
              value={rule.value}
              onChange={(e) =>
                onChange({ ...rule, value: Number(e.target.value) })
              }
            />
            <span className="mono faint" style={{ fontSize: 10.5 }}>
              count
            </span>
          </div>
        </>
      )}
    </div>
  );
}
