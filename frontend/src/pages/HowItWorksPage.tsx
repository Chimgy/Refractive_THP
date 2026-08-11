import { useState } from 'react';

type Props = { onSignIn?: () => void; onBack?: () => void };

const SECTIONS = [
  '01 · Design principles',
  '02 · System architecture',
  '03 · Data model',
  '04 · Integrations',
  '05 · API surface',
  '06 · Auth & security',
  '07 · Trade-offs',
];

const PRINCIPLES = [
  [
    'Absence is a first-class state',
    "Change failure rate and MTTR render as dashed, labelled gaps rather than zeroes. A metric you can't source honestly is worse than no metric.",
  ],
  [
    'One accent, four semantics',
    'Purple is interaction, green is healthy, amber is degraded, red is breach. Nothing else is coloured, so a coloured pixel always means something.',
  ],
  [
    'Tabs over sidebars',
    'The three domains are peers within one project, not separate destinations. Tabs keep the project context fixed while the data plane swaps.',
  ],
  [
    'Numbers are the illustration',
    "No stock imagery, no icon sets. Charts are hand-rolled SVG so the visual weight matches the type scale instead of a library's defaults.",
  ],
];

const ARCH = [
  {
    head: 'SOURCES',
    items: [
      ['GitHub REST + GraphQL', ''],
      ['AWS CloudWatch', ''],
      ['Cloudflare Analytics', ''],
      ['THP_analytics.js', ''],
    ],
    accentLast: true,
  },
  {
    head: 'SERVICE — ECS FARGATE',
    items: [
      ['poller', 'EventBridge hourly · per-source adapters · writes snapshots'],
      ['api', 'Node + Fastify · REST/JSON · reads only from Postgres'],
      ['ingest', 'POST /telemetry · batched, schema-validated, rate-limited'],
      ['', 'ALB · Cloudflare in front · WAF at the edge'],
    ],
  },
  {
    head: 'STORAGE & CLIENT',
    items: [
      ['RDS Postgres 16', 'metrics, events, credentials · single-AZ, PITR on'],
      ['Secrets Manager', 'PATs and tokens · never in the metrics DB'],
      ['React 19 SPA', 'Vite + TypeScript · recharts · S3 + CloudFront'],
    ],
  },
];

const TABLES = [
  ['users', 'identity, role, workspace membership', 'argon2id hash'],
  ['projects', 'the unit everything hangs off', 'slug unique per workspace'],
  ['connections', 'one row per source per project', 'secret_arn, not the secret'],
  ['metric_snapshots', 'hourly rollups, one row per poll', 'JSONB payload + BRIN on ts'],
  ['deployments', 'releases + ECS events, deduped', 'source of deploy freq'],
  ['telemetry_events', 'raw page views, sessions, tagged clicks', 'partitioned monthly, 90d TTL'],
  ['audit_log', 'credential writes and role changes', 'append-only'],
];

const INTEGRATIONS = [
  {
    name: 'GitHub',
    api: 'REST + GraphQL',
    body: 'Releases and merged PRs give deployment frequency and lead time. GraphQL for the PR timeline (one round trip instead of n), REST for releases. Conditional requests with ETags keep the hourly poll inside the rate limit.',
    status: 'CONNECTED',
    tone: 'live',
  },
  {
    name: 'AWS CloudWatch',
    api: 'GetMetricData',
    body: 'ALB latency percentiles, 5xx counts, ECS task CPU/memory, RDS connections. Access is a cross-account read-only IAM role assumed per poll — no long-lived keys ever enter the system.',
    status: 'PENDING ROLE',
    tone: 'partial',
  },
  {
    name: 'Cloudflare',
    api: 'Analytics GraphQL',
    body: 'Edge-side truth: request volume, status-code mix, cache hit ratio, threats blocked. Scoped zone-read token, rotated quarterly.',
    status: 'CONNECTED',
    tone: 'live',
  },
  {
    name: 'THP_analytics.js',
    api: 'first-party, ~2KB',
    body: 'Written rather than adopted, so the data model matches the dashboard exactly. Batches events, flushes on visibilitychange via sendBeacon, cookieless with a rotating session id. Opt-in click tracking through a data attribute.',
    status: 'INGESTING',
    tone: 'live',
    highlight: true,
  },
];

const ENDPOINTS: [string, string, string, string, string][] = [
  ['GET', '/projects', 'list + health summary', 'viewer', 'get'],
  ['GET', '/projects/:id/dora?range=90d', 'deploy freq, lead time, series', 'viewer', 'get'],
  ['GET', '/projects/:id/infra?range=7d', 'latency, errors, utilisation', 'viewer', 'get'],
  ['GET', '/projects/:id/telemetry', 'views, sessions, top pages', 'viewer', 'get'],
  ['POST', '/projects/:id/connections', 'writes secret, returns arn ref', 'admin', 'admin'],
  ['POST', '/projects/:id/refresh', 'forces an out-of-band poll', 'admin', 'admin'],
  ['POST', '/telemetry', 'event batch ingest', 'project key', 'key'],
  ['POST', '/auth/login · /auth/register', 'issues 24h JWT + refresh', 'public', 'post'],
];

const SECURITY = [
  [
    'Sessions',
    '24h access JWT in memory, refresh token in an httpOnly SameSite=Strict cookie. Rotation on every refresh, reuse detection revokes the family.',
  ],
  [
    'SSO',
    'OAuth 2.0 authorisation code with PKCE for GitHub, Google and Microsoft. GitHub sign-in doubles as the repo grant, collapsing two consent screens into one.',
  ],
  [
    'Roles',
    'Two roles only — viewer reads, admin writes credentials. Every credential write lands in an append-only audit log with actor, ip and diff.',
  ],
];

const TRADEOFFS = [
  [
    'Hourly polling, not webhooks',
    'Simpler to build and to reason about backfill, but the dashboard is up to an hour stale. Webhooks for deployments would fix the metric that most wants to be live.',
  ],
  [
    'Two of four DORA metrics',
    'Change failure rate and MTTR need an incident source. ECS rollback events are the nearest proxy shipped; a PagerDuty or Statuspage adapter is the real answer.',
  ],
  [
    'Single-AZ database',
    'A deliberate cost choice for an internal tool with point-in-time recovery. Multi-AZ is a config flag away if this ever became load-bearing.',
  ],
  [
    'Monolith on ECS',
    'Poller and API share a deploy unit, so a bad adapter can take down reads. Module boundaries are clean enough to split the poller out when that stops being acceptable.',
  ],
];

function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
      <span className="mono" style={{ fontSize: 11, color: 'rgba(237,237,240,.3)' }}>{n}</span>
      <h2 style={{ margin: 0, font: '400 26px var(--sans)', letterSpacing: '-0.02em' }}>{title}</h2>
    </div>
  );
}

const LEAD: React.CSSProperties = {
  margin: '16px 0 0',
  maxWidth: '46em',
  font: '400 14.5px/1.7 var(--sans)',
  color: 'rgba(237,237,240,.6)',
  textWrap: 'pretty',
};

export default function HowItWorksPage({ onSignIn, onBack }: Props) {
  const [active, setActive] = useState(0);

  return (
    <div style={{ minHeight: '100svh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 34px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          className="link-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)' }}
          onClick={onBack}
        >
          <div style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--accent)' }} />
          <span style={{ font: '600 13px var(--sans)', letterSpacing: '-0.01em' }}>THP Portal</span>
        </button>
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            font: '400 12.5px var(--sans)',
            color: 'rgba(237,237,240,.5)',
          }}
        >
          <span style={{ color: 'var(--text)' }}>How it works</span>
          <a href="#metrics">Metrics</a>
          <a href="#docs">Docs</a>
          <button type="button" className="btn btn-primary" style={{ height: 30 }} onClick={onSignIn}>
            Sign in
          </button>
        </nav>
      </header>

      <section style={{ padding: '64px 54px 46px', borderBottom: '1px solid var(--border)' }}>
        <div
          className="mono"
          style={{ fontSize: 10.5, letterSpacing: '0.16em', color: '#9b82ea', textTransform: 'uppercase' }}
        >
          Build notes · v0.4
        </div>
        <h1
          style={{
            margin: '20px 0 0',
            maxWidth: '16em',
            font: '400 46px/1.08 var(--sans)',
            letterSpacing: '-0.03em',
            textWrap: 'pretty',
          }}
        >
          How this thing is put together, and why.
        </h1>
        <p style={{ ...LEAD, font: '400 15.5px/1.65 var(--sans)', maxWidth: '44em', marginTop: 22 }}>
          A delivery-intelligence portal built solo: one auth layer, three ingestion paths, one
          dashboard. This page is the reasoning behind each decision — including the ones I'd make
          differently now.
        </p>
        <div style={{ display: 'flex', gap: 44, marginTop: 38 }}>
          {[
            ['3', 'data domains'],
            ['4', 'external APIs'],
            ['1', 'Postgres instance'],
            ['0', 'runtime dependencies on a vendor SDK'],
          ].map(([v, l]) => (
            <div key={l}>
              <div className="mono" style={{ fontSize: 24 }}>{v}</div>
              <div style={{ marginTop: 4, font: '400 11.5px var(--sans)', color: 'rgba(237,237,240,.45)' }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '224px minmax(0,1fr)' }}>
        <aside
          style={{
            borderRight: '1px solid var(--border)',
            padding: '34px 26px',
            background: 'var(--panel-2)',
            alignSelf: 'start',
            position: 'sticky',
            top: 0,
          }}
        >
          <div className="label">Contents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 16 }}>
            {SECTIONS.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`toc-item${i === active ? ' toc-item-on' : ''}`}
                onClick={() => {
                  setActive(i);
                  const el = document.getElementById(`hiw-${i}`);
                  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24 });
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div
            className="mono"
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: '1px solid rgba(255,255,255,.07)',
              font: '400 11px/1.6 var(--mono)',
              color: 'var(--faint)',
            }}
          >
            last updated
            <br />
            2026-08-11
          </div>
        </aside>

        <main style={{ padding: '44px 54px 60px', display: 'flex', flexDirection: 'column', gap: 52 }}>
          <section id="hiw-0">
            <SectionHead n="01" title="Design principles" />
            <p style={LEAD}>
              The portal is a reading instrument, not an app you spend the day in. Every layout
              decision follows from that: dense numeric tables, monospace for anything comparable,
              one accent colour reserved for state that matters.
            </p>
            <div className="grid-hair" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
              {PRINCIPLES.map(([t, b]) => (
                <div key={t} className="hair-cell">
                  <div style={{ font: '500 13px var(--sans)' }}>{t}</div>
                  <p style={{ margin: '8px 0 0', font: '400 13px/1.6 var(--sans)', color: 'var(--muted)' }}>{b}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="hiw-1">
            <SectionHead n="02" title="System architecture" />
            <p style={LEAD}>
              A modular monolith on ECS Fargate. Ingestion is decoupled from serving by the database,
              not by a queue — at this volume a scheduled worker writing snapshots is simpler to
              reason about and cheaper to run.
            </p>
            <div className="panel" style={{ marginTop: 26, padding: '26px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }}>
                {ARCH.map((col) => (
                  <div key={col.head} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div className="label">{col.head}</div>
                    {col.items.map(([title, body], i) => {
                      const accent = col.accentLast && i === col.items.length - 1;
                      const ghost = !title;
                      return (
                        <div
                          key={title || body}
                          style={{
                            padding: '13px 14px',
                            borderRadius: 7,
                            border: ghost
                              ? '1px dashed var(--border-strong)'
                              : `1px solid ${accent ? 'rgba(123,92,224,.4)' : 'rgba(255,255,255,.11)'}`,
                            background: ghost ? 'transparent' : accent ? 'rgba(123,92,224,.09)' : '#131319',
                          }}
                        >
                          {title && (
                            <div
                              className="mono"
                              style={{ font: '500 12px var(--mono)', color: accent ? 'var(--accent-text)' : 'var(--text)' }}
                            >
                              {title}
                            </div>
                          )}
                          {body && (
                            <div
                              className="mono"
                              style={{
                                marginTop: title ? 4 : 0,
                                font: '400 11px/1.5 var(--mono)',
                                color: 'rgba(237,237,240,.42)',
                              }}
                            >
                              {body}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div
                className="mono"
                style={{
                  marginTop: 20,
                  paddingTop: 18,
                  borderTop: '1px solid rgba(255,255,255,.07)',
                  font: '400 11.5px/1.6 var(--mono)',
                  color: 'rgba(237,237,240,.42)',
                }}
              >
                flow — sources → poller (hourly) → postgres → api → SPA. The browser never talks to a
                third-party API directly; every credential stays server-side.
              </div>
            </div>
          </section>

          <section id="hiw-2">
            <SectionHead n="03" title="Data model & database choice" />
            <p style={LEAD}>
              Postgres over a time-series store. The workload is small, but it's relational at the
              edges — projects own connections own snapshots — and mixing a document store in for
              telemetry would have meant two consistency models for one dashboard. JSONB covers the
              shape-varying payloads without giving up joins.
            </p>
            <div style={{ marginTop: 24, border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
              <div className="thead" style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 190px' }}>
                <span>TABLE</span>
                <span>PURPOSE</span>
                <span>NOTES</span>
              </div>
              {TABLES.map(([t, p, n]) => (
                <div
                  key={t}
                  className="tr mono"
                  style={{ gridTemplateColumns: '150px minmax(0,1fr) 190px', padding: '13px 18px', fontSize: 12 }}
                >
                  <span style={{ color: 'var(--accent-text)' }}>{t}</span>
                  <span style={{ color: 'var(--muted)' }}>{p}</span>
                  <span style={{ color: 'var(--faint)' }}>{n}</span>
                </div>
              ))}
            </div>
            <div className="note mono">
              why not Timescale / Influx — under ~10M rows a partitioned Postgres table with BRIN
              indexes answers the same queries in single-digit ms, and keeps one backup story, one
              migration tool, one thing to operate.
            </div>
          </section>

          <section id="hiw-3">
            <SectionHead n="04" title="Integrations" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
              {INTEGRATIONS.map((it) => (
                <div
                  key={it.name}
                  className="panel"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '180px minmax(0,1fr) 130px',
                    gap: 20,
                    alignItems: 'start',
                    padding: '18px 20px',
                    ...(it.highlight
                      ? { border: '1px solid rgba(123,92,224,.3)', background: 'rgba(123,92,224,.06)' }
                      : null),
                  }}
                >
                  <div>
                    <div style={{ font: '500 13px var(--sans)' }}>{it.name}</div>
                    <div className="mono" style={{ marginTop: 4, fontSize: 10.5, color: 'var(--faint)' }}>{it.api}</div>
                  </div>
                  <p style={{ margin: 0, font: '400 13px/1.6 var(--sans)', color: 'var(--muted)' }}>{it.body}</p>
                  <span
                    className={`pill ${it.tone === 'live' ? 'pill-live' : 'pill-partial'}`}
                    style={{ justifySelf: 'end' }}
                  >
                    {it.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section id="hiw-4">
            <SectionHead n="05" title="API surface" />
            <p style={LEAD}>
              REST over GraphQL: the client's read patterns are fixed and few, so a handful of shaped
              endpoints beats a resolver layer plus query-cost policing. Everything is namespaced
              under <span className="mono" style={{ fontSize: 13, color: 'var(--accent-text)' }}>/api/v1</span>.
            </p>
            <div style={{ marginTop: 22, border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
              <div
                className="thead"
                style={{ display: 'grid', gridTemplateColumns: '64px 300px minmax(0,1fr) 110px' }}
              >
                <span>VERB</span>
                <span>PATH</span>
                <span>RETURNS</span>
                <span>AUTH</span>
              </div>
              {ENDPOINTS.map(([verb, path, ret, auth, tone]) => (
                <div
                  key={path}
                  className="tr mono"
                  style={{
                    gridTemplateColumns: '64px 300px minmax(0,1fr) 110px',
                    padding: '12px 18px',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: verb === 'GET' ? 'var(--good)' : 'var(--warn)' }}>{verb}</span>
                  <span style={{ color: 'rgba(237,237,240,.8)' }}>{path}</span>
                  <span style={{ color: 'var(--muted)' }}>{ret}</span>
                  <span
                    style={{
                      color:
                        tone === 'admin' ? 'var(--warn)' : tone === 'key' ? '#9b82ea' : 'var(--faint)',
                    }}
                  >
                    {auth}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section id="hiw-5">
            <SectionHead n="06" title="Auth & security" />
            <div className="grid-hair" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginTop: 22 }}>
              {SECURITY.map(([t, b]) => (
                <div key={t} className="hair-cell">
                  <div style={{ font: '500 13px var(--sans)' }}>{t}</div>
                  <p style={{ margin: '8px 0 0', font: '400 12.5px/1.6 var(--sans)', color: 'var(--muted)' }}>{b}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="hiw-6">
            <SectionHead n="07" title="Trade-offs I'd revisit" />
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border)' }}>
              {TRADEOFFS.map(([t, b]) => (
                <div
                  key={t}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)',
                    gap: 24,
                    padding: '18px 2px',
                    borderBottom: '1px solid rgba(255,255,255,.07)',
                  }}
                >
                  <span style={{ font: '500 13.5px var(--sans)' }}>{t}</span>
                  <span style={{ font: '400 13px/1.6 var(--sans)', color: 'var(--muted)' }}>{b}</span>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
