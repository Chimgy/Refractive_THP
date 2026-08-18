import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { COMPARATORS, SESSION_TIME_UNITS, type Comparator, type SessionTimeUnit } from '../dauWauMau/activeUserRules';
import {
  COHORT_TYPE_OPTIONS,
  RETENTION_FEATURE_OPTIONS,
  defaultRetentionBasis,
  entityNamesFor,
  type CohortType,
  type RetentionBasis,
  type RetentionConfig,
  type RetentionFeatureKey,
} from './config';

type Props = {
  value: RetentionConfig;
  onCancel: () => void;
  onSave: (next: Partial<RetentionConfig>) => void;
};

const BASIS_KIND_LABELS: { kind: RetentionBasis['kind']; label: string }[] = [
  { kind: 'logged_in', label: 'Logged in' },
  { kind: 'stayed_on_site', label: 'Stayed on site for x amount of time' },
  { kind: 'feature_engagement', label: 'Engaged with a feature' },
  { kind: 'visited_page', label: 'Went to a specific page' },
];

export default function RetentionEditor({ value, onCancel, onSave }: Props) {
  const [cohortWeeks, setCohortWeeks] = useState(value.cohortWeeks);
  const [cohortType, setCohortType] = useState(value.cohortType);
  const [selectedEntities, setSelectedEntities] = useState(
    value.selectedEntities.length > 0 ? value.selectedEntities : entityNamesFor(value.cohortType),
  );
  const [basis, setBasis] = useState<RetentionBasis>(value.retentionBasis);

  const changeCohortType = useCallback((next: CohortType) => {
    setCohortType(next);
    setSelectedEntities(entityNamesFor(next));
  }, []);

  const toggleEntity = useCallback((name: string) => {
    setSelectedEntities((prev) => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev;
        return prev.filter((n) => n !== name);
      }
      return [...prev, name];
    });
  }, []);

  const handleSave = useCallback(
    () => onSave({ cohortWeeks, cohortType, selectedEntities, retentionBasis: basis }),
    [cohortWeeks, cohortType, selectedEntities, basis, onSave],
  );

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="panel modal-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span className="card-title">Edit widget</span>
          <div className="mono faint" style={{ marginTop: 4, fontSize: 10.5 }}>
            Define what a cohort row is, and what counts as "retained".
          </div>
        </div>

        <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
          <div className="label">Counts as retained if</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {BASIS_KIND_LABELS.map((b) => (
              <div key={b.kind}>
                <button
                  type="button"
                  className={`toggle-pill ${basis.kind === b.kind ? 'toggle-pill-on' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => setBasis(defaultRetentionBasis(b.kind))}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      border: '1px solid currentColor',
                      background: basis.kind === b.kind ? 'currentColor' : 'transparent',
                    }}
                  />
                  {b.label}
                </button>

                {basis.kind === b.kind && basis.kind === 'stayed_on_site' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginLeft: 18 }}>
                    <select
                      className="select"
                      value={basis.comparator}
                      onChange={(e) => setBasis({ ...basis, comparator: e.target.value as Comparator })}
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
                      value={basis.value}
                      onChange={(e) => setBasis({ ...basis, value: Number(e.target.value) })}
                    />
                    <select
                      className="select"
                      value={basis.unit}
                      onChange={(e) => setBasis({ ...basis, unit: e.target.value as SessionTimeUnit })}
                    >
                      {SESSION_TIME_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {basis.kind === b.kind && basis.kind === 'feature_engagement' && (
                  <div style={{ marginTop: 8, marginLeft: 18 }}>
                    <select
                      className="select"
                      value={basis.feature}
                      onChange={(e) =>
                        setBasis({ ...basis, feature: e.target.value as RetentionFeatureKey })
                      }
                    >
                      {RETENTION_FEATURE_OPTIONS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {basis.kind === b.kind && basis.kind === 'visited_page' && (
                  <div style={{ marginTop: 8, marginLeft: 18 }}>
                    <input
                      className="input-compact"
                      type="text"
                      style={{ width: 200 }}
                      value={basis.path}
                      onChange={(e) => setBasis({ ...basis, path: e.target.value })}
                      placeholder="/pricing"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="label" style={{ marginTop: 20 }}>
            Cohort rows are defined by
          </div>
          <select
            className="select"
            style={{ marginTop: 10, width: '100%' }}
            value={cohortType}
            onChange={(e) => changeCohortType(e.target.value as CohortType)}
          >
            {COHORT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {cohortType !== 'weekly_signup' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {entityNamesFor(cohortType).map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`toggle-pill ${selectedEntities.includes(name) ? 'toggle-pill-on' : ''}`}
                  onClick={() => toggleEntity(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div className="label" style={{ marginTop: 20 }}>
            {cohortType === 'weekly_signup' ? 'Cohorts shown' : 'Weeks tracked per row'}
          </div>
          <input
            className="input-compact"
            type="number"
            min={4}
            max={26}
            style={{ marginTop: 10, width: 100 }}
            value={cohortWeeks}
            onChange={(e) => setCohortWeeks(Number(e.target.value))}
          />
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
