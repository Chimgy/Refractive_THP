import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  pendingConnections?: number;
  sessionExpiry?: string;
  version?: string;
  onSignOut?: () => void;
};

function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Avatar button + dropdown. Closes on outside click and Escape.
 * Menu items are buttons so they stay keyboard reachable — wire each
 * to a route once the router lands.
 */
export default function ProfileMenu({
  pendingConnections = 0,
  sessionExpiry,
  version = 'v0.4.1',
  onSignOut,
}: Props) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const name = user?.displayName || user?.email || 'Signed out';
  const email = user?.email ?? '';
  const role = (user?.role ?? 'member').toUpperCase();
  const initials = initialsFor(name);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        type="button"
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          border: open ? '1px solid var(--accent)' : '1px solid transparent',
          cursor: 'pointer',
        }}
      >
        {initials}
      </button>

      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div
              className="avatar"
              style={{ width: 34, height: 34, fontSize: 12 }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '500 13px var(--sans)' }}>{name}</div>
              <div
                className="mono"
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  color: 'var(--faint)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {email}
              </div>
            </div>
            <span
              className="pill pill-dev"
              style={{ marginLeft: 'auto', flex: 'none' }}
            >
              {role}
            </span>
          </div>

          <div className="menu-group">
            <button type="button" className="menu-item" role="menuitem">
              Account settings
            </button>
            <button type="button" className="menu-item" role="menuitem">
              Connections
              {pendingConnections > 0 && (
                <span
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    fontWeight: 500,
                    color: 'var(--warn)',
                  }}
                >
                  {pendingConnections} PENDING
                </span>
              )}
            </button>
            <button type="button" className="menu-item" role="menuitem">
              API tokens
            </button>
            <button type="button" className="menu-item" role="menuitem">
              Team &amp; roles
            </button>
          </div>

          <div className="menu-group">
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={toggleTheme}
            >
              Theme
              <span
                className="mono"
                style={{ fontSize: 10, color: 'var(--faint)' }}
              >
                {theme.toUpperCase()}
              </span>
            </button>
          </div>

          <div className="menu-group">
            <button
              type="button"
              className="menu-item menu-item-danger"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut?.();
              }}
            >
              Sign out
            </button>
          </div>

          <div className="menu-foot mono">
            <span>
              {sessionExpiry ? `session expires ${sessionExpiry}` : email}
            </span>
            <span>{version}</span>
          </div>
        </div>
      )}
    </div>
  );
}
