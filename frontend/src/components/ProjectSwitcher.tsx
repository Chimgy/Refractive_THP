import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as projectsApi from '../api/projects';

type Props = {
  activeProjectId: string;
  label: string;
};

/**
 * Project name button + dropdown, styled after ProfileMenu. Closes on
 * outside click and Escape. Project list is fetched lazily on first open
 * rather than on every render of the header.
 */
export default function ProjectSwitcher({ activeProjectId, label }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<projectsApi.Project[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || projects !== null) return;
    let cancelled = false;
    projectsApi
      .list()
      .then((res) => {
        if (!cancelled) setProjects(res);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projects]);

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
        className="btn"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ height: 30, gap: 8 }}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="mono faint" style={{ fontSize: 10 }}>
          ⌄
        </span>
      </button>

      {open && (
        <div className="menu" role="menu" style={{ minWidth: 220 }}>
          <div className="menu-group">
            {projects === null ? (
              <div
                className="mono faint"
                style={{ padding: '8px 10px', fontSize: 11.5 }}
              >
                {loadFailed ? 'Failed to load projects.' : 'Loading…'}
              </div>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    if (p.id !== activeProjectId) navigate(`/projects/${p.id}`);
                  }}
                >
                  {p.name}
                  {p.id === activeProjectId && (
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: 'var(--accent-text)' }}
                    >
                      CURRENT
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="menu-group">
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/projects');
              }}
            >
              View all projects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
