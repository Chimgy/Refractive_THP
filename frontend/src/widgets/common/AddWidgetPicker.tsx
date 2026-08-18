import { listWidgetRegistryEntries } from '../registry';

type Props = {
  onCancel: () => void;
  onPick: (type: string) => void;
};

// Lists whatever is registered in registry.ts — new widget types just need
// to call registerWidget() in their own config.ts, nothing here changes.
export default function AddWidgetPicker({ onCancel, onPick }: Props) {
  const entries = listWidgetRegistryEntries();

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
          <span className="card-title">Add widget</span>
          <div className="mono faint" style={{ marginTop: 4, fontSize: 10.5 }}>
            Pick a widget template to drop onto the grid.
          </div>
        </div>

        <div
          style={{
            padding: '16px 20px',
            overflow: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {entries.map((entry) => (
            <button
              key={entry.type}
              type="button"
              className="dashed"
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
              onClick={() => onPick(entry.type)}
            >
              <span
                style={{ font: '500 13px var(--sans)', color: 'var(--text)' }}
              >
                {entry.label}
              </span>
              <span className="mono faint" style={{ fontSize: 11 }}>
                {entry.description}
              </span>
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
