import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { INTERVAL_OPTIONS, type GrowthIndicatorConfig, type GrowthSegment } from './config';

const SEGMENT_OPTIONS: { key: GrowthSegment; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'returning', label: 'Returning' },
  { key: 'dormant', label: 'Dormant' },
  { key: 'resurrecting', label: 'Resurrecting' },
];

type Props = {
  value: GrowthIndicatorConfig;
  onCancel: () => void;
  onSave: (next: Partial<GrowthIndicatorConfig>) => void;
};

export default function GrowthIndicatorEditor({ value, onCancel, onSave }: Props) {
  const [interval, setInterval] = useState(value.interval);
  const [periods, setPeriods] = useState(value.periods);
  const [dormantAfterWeeks, setDormantAfterWeeks] = useState(value.dormantAfterWeeks);
  const [visibleSegments, setVisibleSegments] = useState(value.visibleSegments);

  const toggleSegment = useCallback((key: GrowthSegment) => {
    setVisibleSegments((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }, []);

  const handleSave = useCallback(
    () => onSave({ interval, periods, dormantAfterWeeks, visibleSegments }),
    [interval, periods, dormantAfterWeeks, visibleSegments, onSave],
  );

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="panel modal-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span className="card-title">Edit widget</span>
          <div className="mono faint" style={{ marginTop: 4, fontSize: 10.5 }}>
            Choose which segments appear, the time interval, and what counts
            as dormant.
          </div>
        </div>

        <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
          <div className="label">Segments shown</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {SEGMENT_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`toggle-pill ${visibleSegments.includes(s.key) ? 'toggle-pill-on' : ''}`}
                onClick={() => toggleSegment(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="label" style={{ marginTop: 20 }}>
            Interval
          </div>
          <select
            className="select"
            style={{ marginTop: 10 }}
            value={interval}
            onChange={(e) => setInterval(e.target.value as GrowthIndicatorConfig['interval'])}
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="label" style={{ marginTop: 20 }}>
            Periods shown
          </div>
          <input
            className="input-compact"
            type="number"
            min={4}
            max={26}
            style={{ marginTop: 10, width: 100 }}
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
          />

          <div className="label" style={{ marginTop: 20 }}>
            Dormant threshold
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span className="mono faint" style={{ fontSize: 11 }}>
              hasn't been active for
            </span>
            <input
              className="input-compact"
              type="number"
              min={1}
              style={{ width: 80 }}
              value={dormantAfterWeeks}
              onChange={(e) => setDormantAfterWeeks(Number(e.target.value))}
            />
            <span className="mono faint" style={{ fontSize: 11 }}>
              weeks
            </span>
          </div>

          <div
            className="dashed"
            style={{
              marginTop: 20,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            title="IP-based identification isn't legally usable for anonymous visitors, so this widget only covers logged-in users."
          >
            <input type="checkbox" checked disabled style={{ width: 16, height: 16, flex: 'none' }} />
            <span className="mono faint" style={{ fontSize: 11 }}>
              Logged-in users only — IP collection isn't legal for anonymous
              visitors
            </span>
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
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
