import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authErrorMessage, useAuth } from '../auth/AuthContext';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import SsoButton, { SsoDivider } from '../components/SsoButtons';

const steps = [
  ['01', 'Authorise the provider — no password to store.'],
  ['02', 'Pick the repos this workspace should poll.'],
  ['03', 'First poll runs immediately; 90 days backfilled.'],
];

/** Crude local strength meter — replace with the server-side zxcvbn score. */
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[A-Za-z]/.test(pw)) s++;
  return Math.min(s, 4);
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const score = strength(password);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ companyName, displayName: name, email, password });
      navigate('/projects/new');
    } catch (err) {
      setError(authErrorMessage(err, 'Sign up failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
    >
      <SiteHeader />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,.9fr) minmax(420px,1.1fr)',
          flex: 1,
        }}
      >
        <section style={{ padding: '56px 46px 52px' }}>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: '0.16em',
              color: '#9b82ea',
              textTransform: 'uppercase',
            }}
          >
            Create account
          </div>
          <h1
            style={{
              margin: '20px 0 0',
              font: '400 40px/1.1 var(--sans)',
              letterSpacing: '-0.03em',
              textWrap: 'pretty',
            }}
          >
            Connect a repo, see the metrics in minutes.
          </h1>
          <p
            style={{
              margin: '20px 0 0',
              maxWidth: '32em',
              font: '400 14.5px/1.6 var(--sans)',
              color: 'rgba(237,237,240,.55)',
              textWrap: 'pretty',
            }}
          >
            Signing up with GitHub is the fast path — it grants the read scope
            the delivery metrics need in the same step.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              marginTop: 38,
            }}
          >
            {steps.map(([n, body]) => (
              <div
                key={n}
                style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11, color: 'rgba(237,237,240,.3)' }}
                >
                  {n}
                </span>
                <span
                  style={{
                    font: '400 13px/1.5 var(--sans)',
                    color: 'rgba(237,237,240,.6)',
                  }}
                >
                  {body}
                </span>
              </div>
            ))}
          </div>

          <div
            className="mono"
            style={{
              marginTop: 40,
              padding: '16px 18px',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 9,
              background: 'var(--panel-2)',
              font: '400 11.5px/1.6 var(--mono)',
              color: 'rgba(237,237,240,.45)',
            }}
          >
            Workspace domains are allow-listed. sam@thp.dev joins{' '}
            <span style={{ color: 'var(--accent-text)' }}>THP</span>{' '}
            automatically as a viewer.
          </div>
        </section>

        <section
          style={{
            padding: '56px 60px 52px',
            background: 'var(--panel-2)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <form
            className="panel"
            style={{ width: '100%', maxWidth: 400, padding: '30px 28px' }}
            onSubmit={handleSubmit}
          >
            <div
              style={{ font: '500 17px var(--sans)', letterSpacing: '-0.01em' }}
            >
              Sign up
            </div>
            <div
              style={{
                marginTop: 7,
                font: '400 12.5px/1.5 var(--sans)',
                color: 'rgba(237,237,240,.45)',
              }}
            >
              Already have an account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/login')}
              >
                Sign in
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
              <SsoButton provider="github" emphasis badge="RECOMMENDED" />
              <SsoButton provider="google" />
              <SsoButton provider="microsoft" />
            </div>

            <SsoDivider label="OR EMAIL" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
              >
                <span className="label">Workspace name</span>
                <input
                  type="text"
                  autoComplete="organization"
                  placeholder="Acme Inc"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </label>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
              >
                <span className="label">Full name</span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Sam Okafor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
              >
                <span className="label">Work email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
              >
                <span className="label">Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 4, marginTop: 1 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        background:
                          i < score ? 'var(--good)' : 'rgba(255,255,255,.09)',
                      }}
                    />
                  ))}
                </div>
                <span
                  className="mono"
                  style={{ fontSize: 10.5, color: 'var(--faint)' }}
                >
                  12+ chars ·{' '}
                  {['too short', 'weak', 'fair', 'good', 'strong'][score]}
                </span>
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
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
              <p
                style={{
                  margin: '2px 0 0',
                  font: '400 11px/1.6 var(--sans)',
                  color: 'rgba(237,237,240,.38)',
                  textWrap: 'pretty',
                }}
              >
                By creating an account you agree to the acceptable-use policy.
                Credentials are hashed with argon2id; sessions are 24h JWTs.
              </p>
            </div>
          </form>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
