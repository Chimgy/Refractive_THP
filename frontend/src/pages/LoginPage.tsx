import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authErrorMessage, useAuth } from '../auth/AuthContext';
import SsoButton, { SsoDivider } from '../components/SsoButtons';

const domains = [
  {
    n: '01',
    title: 'In development',
    body: 'DORA-style metrics polled from linked GitHub repos.',
    source: 'GITHUB',
  },
  {
    n: '02',
    title: 'Post development',
    body: 'Latency, error rate, bottlenecks and utilisation from live infrastructure.',
    source: 'AWS CLOUDWATCH · CLOUDFLARE',
  },
  {
    n: '03',
    title: 'External telemetry',
    body: 'Page views and sessions via a one-line drop-in snippet.',
    source: 'THP_ANALYTICS.JS',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/projects');
    } catch (err) {
      setError(authErrorMessage(err, 'Sign in failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 34px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: 'var(--accent)',
            }}
          />
          <span
            style={{ font: '600 13px var(--sans)', letterSpacing: '-0.01em' }}
          >
            THP Portal
          </span>
        </div>
        <nav
          style={{
            display: 'flex',
            gap: 26,
            font: '400 12.5px var(--sans)',
            color: 'rgba(237,237,240,.5)',
          }}
        >
          <button
            type="button"
            className="link-btn"
            onClick={() => navigate('/how-it-works')}
          >
            How it works
          </button>
          <a href="#metrics">Metrics</a>
          <a href="#docs">Docs</a>
        </nav>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.15fr) minmax(360px,.85fr)',
          flex: 1,
        }}
      >
        <section style={{ padding: '64px 54px 60px' }}>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: '0.16em',
              color: '#9b82ea',
              textTransform: 'uppercase',
            }}
          >
            Refractive Labs Take-Home Project
          </div>
          <h1
            style={{
              margin: '22px 0 0',
              font: '400 54px/1.06 var(--sans)',
              letterSpacing: '-0.03em',
              maxWidth: '14em',
              textWrap: 'pretty',
            }}
          >
            Live Analytics Platform.
          </h1>
          <p
            style={{
              margin: '24px 0 0',
              maxWidth: '36em',
              font: '400 15.5px/1.62 var(--sans)',
              color: 'rgba(237,237,240,.58)',
              textWrap: 'pretty',
            }}
          >
            Track DORA metrics while you build, DevOps and infrastructure
            metrics once you ship, and real-world usage telemetry after launch.
            Bring development, DevOps, infrastructure, and usage analytics
            together in one place.
          </p>

          <div style={{ marginTop: 44, borderTop: '1px solid var(--border)' }}>
            {domains.map((d) => (
              <div
                key={d.n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '38px 1fr auto',
                  gap: 18,
                  alignItems: 'baseline',
                  padding: '18px 2px',
                  borderBottom: '1px solid rgba(255,255,255,.07)',
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11, color: 'rgba(237,237,240,.32)' }}
                >
                  {d.n}
                </span>
                <div>
                  <div style={{ font: '500 14.5px var(--sans)' }}>
                    {d.title}
                  </div>
                  <div
                    style={{
                      marginTop: 5,
                      font: '400 13px/1.5 var(--sans)',
                      color: 'var(--muted)',
                    }}
                  >
                    {d.body}
                  </div>
                </div>
                <span
                  className="mono"
                  style={{ fontSize: 10.5, color: 'var(--faint)' }}
                >
                  {d.source}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            padding: '64px 54px 60px',
            borderLeft: '1px solid var(--border)',
            background: 'var(--panel-2)',
          }}
        >
          <form
            className="panel"
            style={{ padding: '30px 28px' }}
            onSubmit={handleSubmit}
          >
            <div
              style={{ font: '500 17px var(--sans)', letterSpacing: '-0.01em' }}
            >
              Sign in
            </div>
            <div
              style={{
                marginTop: 7,
                font: '400 12.5px/1.5 var(--sans)',
                color: 'rgba(237,237,240,.45)',
              }}
            >
              No account yet?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/signup')}
              >
                Create one
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                marginTop: 24,
              }}
            >
              <SsoButton provider="github" emphasis />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 9,
                }}
              >
                <SsoButton provider="google" compact />
                <SsoButton provider="microsoft" compact />
              </div>
            </div>

            <SsoDivider />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
              >
                <span className="label">Email</span>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span className="label">Password</span>
                  <a
                    href="#reset"
                    style={{
                      font: '400 11.5px var(--sans)',
                      color: 'rgba(237,237,240,.4)',
                    }}
                  >
                    Forgot?
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && (
                <div
                  className="mono"
                  style={{ fontSize: 11.5, color: 'var(--bad)' }}
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={submitting}
              >
                {submitting ? 'Signing in…' : 'Continue'}
              </button>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  font: '400 12px var(--sans)',
                  color: 'rgba(237,237,240,.42)',
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 10.5, color: 'rgba(237,237,240,.3)' }}
                >
                  SSO via OAuth 2.0 + PKCE
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 10.5, color: 'rgba(237,237,240,.3)' }}
                >
                  JWT · 24H
                </span>
              </div>
            </div>
          </form>

          <div
            style={{
              marginTop: 26,
              padding: '18px 20px',
              border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 10,
            }}
          >
            <div className="label">Currently tracking</div>
            <div style={{ display: 'flex', gap: 34, marginTop: 16 }}>
              <div>
                <div className="mono" style={{ fontSize: 26 }}>
                  12
                </div>
                <div
                  style={{
                    marginTop: 3,
                    font: '400 11.5px var(--sans)',
                    color: 'rgba(237,237,240,.45)',
                  }}
                >
                  projects
                </div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 26 }}>
                  7
                </div>
                <div
                  style={{
                    marginTop: 3,
                    font: '400 11.5px var(--sans)',
                    color: 'rgba(237,237,240,.45)',
                  }}
                >
                  live
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
