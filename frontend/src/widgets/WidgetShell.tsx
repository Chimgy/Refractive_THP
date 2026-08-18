import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { DragHandleProps } from './grid/DashboardGrid';

type Props = {
  title: string;
  description?: string;
  dragHandleProps?: DragHandleProps;
  loading?: boolean;
  headerExtra?: ReactNode;
  onRefresh?: () => void;
  onEdit?: () => void;
  onExport?: () => void;
  onRename?: (nextTitle: string) => void;
  onDuplicate?: () => void;
  onExpand?: () => void;
  onRemove?: () => void;
  children: ReactNode;
};

// The reusable chrome every widget type sits inside: title + description,
// a refresh icon, and a hamburger menu (Refresh / Edit / Export / Rename /
// Duplicate). Kept free of frontend-app-specific imports (no api/, no auth/)
// so it can be copied into internal-frontend later without unpicking it.
export default function WidgetShell({
  title,
  description,
  dragHandleProps,
  loading,
  headerExtra,
  onRefresh,
  onEdit,
  onExport,
  onRename,
  onDuplicate,
  onExpand,
  onRemove,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const commitRename = useCallback(() => {
    setRenaming(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== title) onRename?.(trimmed);
    else setDraftTitle(title);
  }, [draftTitle, title, onRename]);

  const startRename = useCallback(() => {
    setDraftTitle(title);
    setRenaming(true);
    setMenuOpen(false);
  }, [title]);

  return (
    <div
      className="panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--border)',
          ...dragHandleProps?.style,
        }}
        onPointerDown={dragHandleProps?.onPointerDown}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          {renaming ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setDraftTitle(title);
                  setRenaming(false);
                }
              }}
              style={{ height: 26, fontSize: 13, padding: '0 8px' }}
            />
          ) : (
            <span className="card-title" style={{ fontSize: 14.5 }}>
              {title}
            </span>
          )}
          {description && (
            <div
              className="mono faint"
              style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45 }}
            >
              {description}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 'none',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {headerExtra}
          <button
            type="button"
            title="Refresh"
            aria-label="Refresh"
            className="link-btn"
            onClick={onRefresh}
            style={{
              fontSize: 14,
              padding: 4,
              opacity: loading ? 0.5 : 1,
              transform: loading ? 'rotate(180deg)' : undefined,
              transition: 'transform .3s',
            }}
          >
            ⟳
          </button>

          {onExpand && (
            <button
              type="button"
              title="Expand"
              aria-label="Expand"
              className="link-btn"
              onClick={onExpand}
              style={{ fontSize: 13, padding: 4 }}
            >
              ⤢
            </button>
          )}

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              title="More options"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="link-btn"
              onClick={() => setMenuOpen((v) => !v)}
              style={{ fontSize: 14, padding: 4 }}
            >
              ☰
            </button>
            {menuOpen && (
              <div
                className="menu"
                role="menu"
                style={{ width: 176, top: 'calc(100% + 6px)' }}
              >
                <div className="menu-group">
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onRefresh?.();
                    }}
                  >
                    Refresh
                  </button>
                  {onExpand && (
                    <button
                      type="button"
                      className="menu-item"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onExpand();
                      }}
                    >
                      Expand
                    </button>
                  )}
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit?.();
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onExport?.();
                    }}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={startRename}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onDuplicate?.();
                    }}
                  >
                    Duplicate
                  </button>
                </div>
                {onRemove && (
                  <div className="menu-group">
                    <button
                      type="button"
                      className="menu-item menu-item-danger"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onRemove();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '14px 16px 16px',
          overflow: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
