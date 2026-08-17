import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

// A large variant of the small ActiveUserRuleEditor-style modal shell, for
// widgets that need more room than a grid tile can offer (e.g. Retention's
// cohort triangle). Any widget can render whatever it wants inside.
//
// Portaled to document.body: each grid tile is `position: relative` with its
// own z-index (DashboardGrid.tsx), which makes it a stacking context. Left
// inline, this modal's z-index would only ever be compared against its own
// tile's siblings — a tile added later in the widget list sits later in the
// DOM with the same z-index and paints over the whole earlier stacking
// context, modal included, no matter how high modal-backdrop's z-index is.
export default function ExpandedViewModal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="panel modal-panel modal-panel-expanded"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span className="card-title">{title}</span>
          <button type="button" className="link-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ padding: '18px 20px', overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
