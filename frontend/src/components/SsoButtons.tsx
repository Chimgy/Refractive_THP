type Provider = 'github' | 'google' | 'microsoft';

const GLYPH: Record<Provider, string> = { github: '◉', google: '◆', microsoft: '▣' };
const LABEL: Record<Provider, string> = { github: 'GitHub', google: 'Google', microsoft: 'Microsoft' };

type Props = {
  provider: Provider;
  /** Full-width primary treatment — used for GitHub, the recommended path. */
  emphasis?: boolean;
  /** Short label ("Google") instead of "Continue with Google". */
  compact?: boolean;
  badge?: string;
  onClick?: (provider: Provider) => void;
};

/**
 * One SSO button. Auth flow will be OAuth 2.0 authorization code + PKCE, but
 * the backend has no /auth/oauth/:provider route yet — disabled until it
 * lands, rather than pretending a click does something.
 */
export default function SsoButton({ provider, emphasis, compact, badge, onClick }: Props) {
  return (
    <button
      type="button"
      className={`sso-btn${emphasis ? ' sso-btn-emphasis' : ''}`}
      onClick={() => onClick?.(provider)}
      disabled
      title="Not available yet — sign in with email for now"
    >
      <span className="mono" style={{ fontSize: 13, color: 'rgba(237,237,240,.65)' }}>{GLYPH[provider]}</span>
      <span>{compact ? LABEL[provider] : `Continue with ${LABEL[provider]}`}</span>
      {badge && (
        <span className="pill pill-dev" style={{ marginLeft: 6, fontSize: 9 }}>{badge}</span>
      )}
      <span className="pill pill-outline" style={{ marginLeft: 'auto', fontSize: 8.5 }}>SOON</span>
    </button>
  );
}

export function SsoDivider({ label = 'OR' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span
        className="mono"
        style={{ font: '500 10px var(--mono)', letterSpacing: '0.12em', color: 'rgba(237,237,240,.3)' }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}
