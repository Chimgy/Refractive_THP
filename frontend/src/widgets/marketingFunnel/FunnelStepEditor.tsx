import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FEATURE_OPTIONS,
  FUNNEL_STEP_TYPE_OPTIONS,
  defaultFunnelStep,
  type FunnelStep,
  type FunnelStepType,
} from './config';

type Props = {
  steps: FunnelStep[];
  onCancel: () => void;
  onSave: (steps: FunnelStep[]) => void;
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `step-${Date.now()}-${idCounter}`;
}

export default function FunnelStepEditor({
  steps: initial,
  onCancel,
  onSave,
}: Props) {
  const [steps, setSteps] = useState<FunnelStep[]>(initial);

  const updateStep = useCallback((id: string, next: FunnelStep) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? next : s)));
  }, []);

  const changeType = useCallback((id: string, type: FunnelStepType) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? defaultFunnelStep(id, type) : s)),
    );
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) =>
      prev.length > 1 ? prev.filter((s) => s.id !== id) : prev,
    );
  }, []);

  const moveStep = useCallback((id: string, dir: -1 | 1) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const swapIdx = idx + dir;
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, defaultFunnelStep(nextId())]);
  }, []);

  const handleSave = useCallback(() => onSave(steps), [steps, onSave]);

  return createPortal(
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
          <span className="card-title">Edit funnel steps</span>
          <div className="mono faint" style={{ marginTop: 4, fontSize: 10.5 }}>
            Add, remove and reorder the milestones users pass through.
          </div>
        </div>

        <div
          style={{
            padding: '16px 20px',
            overflow: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {steps.map((step, i) => (
            <div
              key={step.id}
              className="dashed"
              style={{
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="mono faint"
                  style={{ fontSize: 10, width: 16 }}
                >
                  {i + 1}
                </span>
                <select
                  className="select"
                  style={{ flex: 1 }}
                  value={step.type}
                  onChange={(e) =>
                    changeType(step.id, e.target.value as FunnelStepType)
                  }
                >
                  {FUNNEL_STEP_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="link-btn"
                  disabled={i === 0}
                  style={{ opacity: i === 0 ? 0.3 : 1 }}
                  onClick={() => moveStep(step.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="link-btn"
                  disabled={i === steps.length - 1}
                  style={{ opacity: i === steps.length - 1 ? 0.3 : 1 }}
                  onClick={() => moveStep(step.id, 1)}
                >
                  ↓
                </button>
                {steps.length > 1 && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => removeStep(step.id)}
                  >
                    remove
                  </button>
                )}
              </div>

              {step.type === 'created_projects_count' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono faint" style={{ fontSize: 11 }}>
                    at least
                  </span>
                  <input
                    className="input-compact"
                    type="number"
                    min={1}
                    style={{ width: 80 }}
                    value={step.threshold ?? 1}
                    onChange={(e) =>
                      updateStep(step.id, {
                        ...step,
                        threshold: Number(e.target.value),
                      })
                    }
                  />
                  <span className="mono faint" style={{ fontSize: 11 }}>
                    projects
                  </span>
                </div>
              )}

              {step.type === 'continued_using' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono faint" style={{ fontSize: 11 }}>
                    for at least
                  </span>
                  <input
                    className="input-compact"
                    type="number"
                    min={1}
                    style={{ width: 80 }}
                    value={step.threshold ?? 7}
                    onChange={(e) =>
                      updateStep(step.id, {
                        ...step,
                        threshold: Number(e.target.value),
                      })
                    }
                  />
                  <span className="mono faint" style={{ fontSize: 11 }}>
                    days
                  </span>
                </div>
              )}

              {step.type === 'clicked_feature' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono faint" style={{ fontSize: 11 }}>
                    feature
                  </span>
                  <select
                    className="select"
                    value={step.featureKey ?? FEATURE_OPTIONS[0]}
                    onChange={(e) =>
                      updateStep(step.id, {
                        ...step,
                        featureKey: e.target.value,
                      })
                    }
                  >
                    {FEATURE_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            className="btn"
            style={{ height: 30, fontSize: 11.5, alignSelf: 'flex-start' }}
            onClick={addStep}
          >
            + Add step
          </button>
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
    </div>,
    document.body,
  );
}
