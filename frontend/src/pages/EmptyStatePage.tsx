type Props = { onDone: () => void };

const paths = [
  {
    title: 'Link a GitHub repo',
    body: 'PAT + org/repo · enables DORA metrics',
  },
  {
    title: 'Connect live infrastructure',
    body: 'Read-only IAM role or Cloudflare token',
  },
  {
    title: 'Drop in the telemetry snippet',
    body: 'One script tag, page views and sessions',
  },
];

export default function EmptyStatePage({ onDone }: Props) {
  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        padding: 40,
      }}
    >
      <div
        className="panel"
        style={{ width: 600, maxWidth: '100%', padding: '44px 40px 40px' }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: '1px dashed rgba(255,255,255,.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: '400 15px var(--mono)',
            color: 'rgba(237,237,240,.4)',
          }}
        >
          +
        </div>
        <h1
          style={{
            marginTop: 22,
            font: '400 24px var(--sans)',
            letterSpacing: '-0.02em',
          }}
        >
          No projects yet
        </h1>
        <p
          style={{
            margin: '10px 0 0',
            maxWidth: '34em',
            font: '400 13.5px/1.6 var(--sans)',
            color: 'var(--muted)',
          }}
        >
          A project ties a repo, a live deployment and its usage data together.
          Start with whichever you have — you can add the rest later.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            marginTop: 26,
          }}
        >
          {paths.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={onDone}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                padding: '15px 16px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--panel)',
              }}
            >
              <span>
                <span
                  style={{ display: 'block', font: '500 13px var(--sans)' }}
                >
                  {p.title}
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: 4,
                    font: '400 11.5px var(--sans)',
                    color: 'rgba(237,237,240,.45)',
                  }}
                >
                  {p.body}
                </span>
              </span>
              <span
                className="mono"
                style={{ fontSize: 12, color: 'var(--accent-text)' }}
              >
                →
              </span>
            </button>
          ))}
        </div>

        <div
          className="mono"
          style={{
            marginTop: 22,
            padding: '14px 16px',
            borderRadius: 8,
            background: '#08080b',
            border: '1px solid rgba(255,255,255,.07)',
            fontSize: 11.5,
            lineHeight: 1.7,
            color: 'var(--muted)',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {
            '<script src="https://thp.dev/THP_analytics.js" data-project-id="abc123"></script>'
          }
        </div>
      </div>
    </div>
  );
}
