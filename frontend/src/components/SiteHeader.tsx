import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ProfileMenu from './ProfileMenu';

const NAV_LINKS: { label: string; to: string }[] = [
  { label: 'How it works', to: '/how-it-works' },
  { label: 'Metrics', to: '/metrics' },
  { label: 'Docs', to: '/docs' },
];

type Props = {
  subtitle?: string;
  project?: { name: string; subtitle: string };
  actions?: ReactNode;
};

export default function SiteHeader({ subtitle, project, actions }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, logout } = useAuth();

  const onBrand = () =>
    navigate(status === 'authenticated' ? '/projects' : '/login');

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <button
          type="button"
          className="link-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--text)',
          }}
          onClick={onBrand}
        >
          <div className="brand-dot" />
          <span
            style={{ font: '600 13px var(--sans)', letterSpacing: '-0.01em' }}
          >
            THP Portal
          </span>
        </button>
        {project && (
          <>
            <button
              type="button"
              className="btn"
              style={{ height: 30, gap: 8 }}
              onClick={() => navigate('/projects')}
            >
              {project.name}
              <span className="mono faint" style={{ fontSize: 10 }}>
                ⌄
              </span>
            </button>
            <span className="mono faint" style={{ fontSize: 11.5 }}>
              {project.subtitle}
            </span>
          </>
        )}
        {subtitle && (
          <span className="mono faint" style={{ fontSize: 11.5 }}>
            {subtitle}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              style={{
                font: '400 12.5px var(--sans)',
                color:
                  location.pathname === l.to
                    ? 'var(--text)'
                    : 'rgba(237,237,240,.5)',
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {actions}
        {status === 'authenticated' ? (
          <ProfileMenu
            onHowItWorks={() => navigate('/how-it-works')}
            onSignOut={() => {
              void logout().then(() => navigate('/login'));
            }}
          />
        ) : status === 'unauthenticated' && location.pathname !== '/login' ? (
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 30 }}
            onClick={() => navigate('/login')}
          >
            Sign in
          </button>
        ) : null}
      </div>
    </div>
  );
}
