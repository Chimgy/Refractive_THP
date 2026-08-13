import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import TopBar from '../components/TopBar';
import {
  connections,
  deploymentSeries,
  errorBudget,
  latencySeries,
  leadTimeBuckets,
  leadTimeSeries,
  pollActivity,
  taggedClicks,
  topPages,
  trafficSeries,
  utilisation,
} from '../data/mock';

type Tab = 'dev' | 'post' | 'telemetry' | 'connections';
type Props = {
  onProjects: () => void;
  onNewProject: () => void;
  onHowItWorks?: () => void;
  onSignOut?: () => void;
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'dev', label: 'In development' },
  { id: 'post', label: 'Post development' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'connections', label: 'Connections' },
];

const axis = {
  stroke: 'rgba(237,237,240,.3)',
  fontSize: 10.5,
  fontFamily: 'var(--mono)',
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  background: '#0f0f14',
  border: '1px solid rgba(255,255,255,.13)',
  borderRadius: 7,
  font: '11.5px var(--mono)',
  color: '#ededf0',
};

function Stat({
  label,
  value,
  unit,
  delta,
  deltaTone = 'muted',
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'good' | 'bad' | 'warn' | 'muted';
}) {
  return (
    <div className="stat">
      <div className="label" style={{ letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div className="stat-value">
        {value}
        {unit ? <span className="stat-unit">{unit}</span> : null}
      </div>
      {delta ? (
        <div
          className={`stat-delta ${deltaTone === 'muted' ? 'faint' : 'delta-' + deltaTone}`}
        >
          {delta}
        </div>
      ) : null}
    </div>
  );
}

function Card({
  title,
  aside,
  children,
  style,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="panel" style={{ padding: '18px 20px', ...style }}>
      <div className="card-head">
        <span className="card-title">{title}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function DevTab() {
  const [range, setRange] = useState('90D');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="stat-strip">
        <Stat
          label="Deploy freq"
          value="4.2"
          unit="/wk"
          delta="▲ 18% vs prev 90d"
          deltaTone="good"
        />
        <Stat
          label="Lead time p50"
          value="18.4"
          unit="h"
          delta="▼ 6.1h vs prev 90d"
          deltaTone="good"
        />
        <Stat
          label="PR review turnaround"
          value="5.8"
          unit="h"
          delta="▲ 1.4h vs prev 90d"
          deltaTone="bad"
        />
        <Stat
          label="Median PR size"
          value="184"
          unit="loc"
          delta="stretch metric"
        />
      </div>

      <Card
        title="Deployment frequency"
        aside={
          <div className="range">
            {['90D', '30D', '12M'].map((r) => (
              <button
                key={r}
                type="button"
                className={r === range ? 'on' : ''}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        }
      >
        <div style={{ height: 190, marginTop: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={deploymentSeries}
              margin={{ top: 4, right: 4, bottom: 0, left: -22 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
              <XAxis dataKey="week" {...axis} />
              <YAxis {...axis} width={38} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: 'rgba(255,255,255,.15)' }}
              />
              <Area
                type="monotone"
                dataKey="deploys"
                stroke="#7b5ce0"
                strokeWidth={2}
                fill="rgba(123,92,224,.16)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card
          title="Lead time for changes"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              p50 / p90 · hours
            </span>
          }
        >
          <div style={{ height: 180, marginTop: 18 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={leadTimeSeries}
                margin={{ top: 4, right: 4, bottom: 0, left: -22 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,.055)"
                  vertical={false}
                />
                <XAxis dataKey="week" {...axis} />
                <YAxis {...axis} width={38} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="p90"
                  stroke="rgba(123,92,224,.45)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#7b5ce0"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Lead time distribution">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
              marginTop: 20,
            }}
          >
            {leadTimeBuckets.map((b) => (
              <div
                key={b.bucket}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '74px 1fr 40px',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11, color: 'rgba(237,237,240,.45)' }}
                >
                  {b.bucket}
                </span>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,.06)',
                  }}
                >
                  <div
                    style={{
                      width: `${b.pct}%`,
                      height: 8,
                      borderRadius: 4,
                      background: b.tone,
                    }}
                  />
                </div>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    textAlign: 'right',
                  }}
                >
                  {b.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="Unavailable metrics"
        aside={
          <span className="mono" style={{ fontSize: 10, color: 'var(--warn)' }}>
            2
          </span>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 16,
          }}
        >
          {['change_failure_rate', 'mttr'].map((m) => (
            <div
              key={m}
              className="dashed"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 13px',
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 12, color: 'var(--muted)' }}
              >
                {m}
              </span>
              <span className="mono faint" style={{ fontSize: 10.5 }}>
                needs incidents
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 12,
            font: '400 11.5px/1.5 var(--sans)',
            color: 'rgba(237,237,240,.4)',
          }}
        >
          GitHub alone can't establish failure or recovery. Roadmap: incident
          source + ECS rollback events.
        </div>
      </Card>
    </div>
  );
}

function PostDevTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="stat-strip">
        <Stat
          label="ALB latency p99"
          value="402"
          unit="ms"
          delta="▲ 38ms vs 24h"
          deltaTone="bad"
        />
        <Stat
          label="5xx error rate"
          value="0.30"
          unit="%"
          delta="▼ 0.08pt vs 24h"
          deltaTone="good"
        />
        <Stat
          label="Requests 24h"
          value="184"
          unit="k"
          delta="▲ 6% vs 24h"
          deltaTone="good"
        />
        <Stat
          label="Cache hit ratio"
          value="91.2"
          unit="%"
          delta="Cloudflare edge"
        />
      </div>

      <Card
        title="ALB response time"
        aside={
          <span className="mono faint" style={{ fontSize: 11 }}>
            p50 / p99 · ms · last 24h
          </span>
        }
      >
        <div style={{ height: 200, marginTop: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={latencySeries}
              margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
              <XAxis dataKey="t" {...axis} />
              <YAxis {...axis} width={42} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="p99"
                stroke="rgba(123,92,224,.45)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="p50"
                stroke="#7b5ce0"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card
          title="Resource utilisation"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              ECS · RDS
            </span>
          }
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 13,
              marginTop: 20,
            }}
          >
            {utilisation.map((u) => (
              <div
                key={u.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '132px 1fr 44px',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    font: '400 12px var(--sans)',
                    color: 'rgba(237,237,240,.6)',
                  }}
                >
                  {u.name}
                </span>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,.06)',
                  }}
                >
                  <div
                    style={{
                      width: `${u.value}%`,
                      height: 8,
                      borderRadius: 4,
                      background: u.tone,
                    }}
                  />
                </div>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    textAlign: 'right',
                  }}
                >
                  {u.value}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Response mix"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              last 24h
            </span>
          }
        >
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: 5,
              overflow: 'hidden',
              marginTop: 22,
            }}
          >
            {errorBudget.map((e) => (
              <div
                key={e.code}
                style={{ width: `${e.share}%`, background: e.tone }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 22, marginTop: 16 }}>
            {errorBudget.map((e) => (
              <div key={e.code}>
                <div className="mono" style={{ fontSize: 18, color: e.tone }}>
                  {e.share}%
                </div>
                <div
                  className="mono faint"
                  style={{ fontSize: 10.5, marginTop: 3 }}
                >
                  {e.code}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{ font: '400 12px var(--sans)', color: 'var(--muted)' }}
            >
              Threats blocked (Cloudflare)
            </span>
            <span className="mono" style={{ fontSize: 12 }}>
              1,284
            </span>
          </div>
        </Card>
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        <div
          className="thead"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 120px 120px 120px 110px',
          }}
        >
          <span>SERVICE</span>
          <span>TASKS</span>
          <span>CPU</span>
          <span>MEMORY</span>
          <span>STATUS</span>
        </div>
        {[
          {
            s: 'portal-api (ECS Fargate)',
            t: '3 / 3',
            c: '42%',
            m: '61%',
            st: 'HEALTHY',
            tone: 'pill-live',
          },
          {
            s: 'poller-worker (ECS Fargate)',
            t: '1 / 1',
            c: '18%',
            m: '34%',
            st: 'HEALTHY',
            tone: 'pill-live',
          },
          {
            s: 'portal-db (RDS Postgres)',
            t: '—',
            c: '27%',
            m: '78% conn',
            st: 'WATCH',
            tone: 'pill-partial',
          },
        ].map((r) => (
          <div
            key={r.s}
            className="tr"
            style={{ gridTemplateColumns: '1.4fr 120px 120px 120px 110px' }}
          >
            <span
              style={{
                font: '400 13px var(--sans)',
                color: 'rgba(237,237,240,.8)',
              }}
            >
              {r.s}
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: 'var(--muted)' }}
            >
              {r.t}
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: 'var(--muted)' }}
            >
              {r.c}
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: 'var(--muted)' }}
            >
              {r.m}
            </span>
            <span className={`pill ${r.tone}`} style={{ justifySelf: 'start' }}>
              {r.st}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// FIRST
function TelemetryTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="stat-strip">
        <Stat
          label="Page views 7d"
          value="31.4"
          unit="k"
          delta="▲ 12% vs prev 7d"
          deltaTone="good"
        />
        <Stat
          label="Sessions 7d"
          value="12.0"
          unit="k"
          delta="▲ 9% vs prev 7d"
          deltaTone="good"
        />
        <Stat
          label="Avg session"
          value="01:48"
          delta="▼ 11s vs prev 7d"
          deltaTone="bad"
        />
        <Stat label="Events 24h" value="2,904" delta="batched ingest" />
      </div>

      <Card
        title="Views and sessions"
        aside={
          <span className="mono faint" style={{ fontSize: 11 }}>
            last 7 days
          </span>
        }
      >
        <div style={{ height: 200, marginTop: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trafficSeries}
              margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
              <XAxis dataKey="day" {...axis} />
              <YAxis {...axis} width={46} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#7b5ce0"
                strokeWidth={2}
                fill="rgba(123,92,224,.16)"
              />
              <Area
                type="monotone"
                dataKey="sessions"
                stroke="#35c08a"
                strokeWidth={2}
                fill="rgba(53,192,138,.10)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}
      >
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span className="card-title">Top pages</span>
          </div>
          <div
            className="thead"
            style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px' }}
          >
            <span>PATH</span>
            <span>VIEWS</span>
            <span>AVG TIME</span>
          </div>
          {topPages.map((p) => (
            <div
              key={p.path}
              className="tr"
              style={{ gridTemplateColumns: '1fr 100px 100px' }}
            >
              <span
                className="mono"
                style={{ fontSize: 12.5, color: 'rgba(237,237,240,.8)' }}
              >
                {p.path}
              </span>
              <span
                className="mono"
                style={{ fontSize: 12, color: 'var(--muted)' }}
              >
                {p.views.toLocaleString()}
              </span>
              <span
                className="mono"
                style={{ fontSize: 12, color: 'var(--muted)' }}
              >
                {p.avg}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card
            title="Tagged clicks"
            aside={
              <span className="mono faint" style={{ fontSize: 11 }}>
                data-thp-event
              </span>
            }
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 11,
                marginTop: 18,
              }}
            >
              {taggedClicks.map((c) => (
                <div
                  key={c.tag}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 46px',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      className="mono"
                      style={{ fontSize: 11.5, color: 'rgba(237,237,240,.7)' }}
                    >
                      {c.tag}
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: 'rgba(255,255,255,.06)',
                        marginTop: 6,
                      }}
                    >
                      <div
                        style={{
                          width: `${(c.count / 812) * 100}%`,
                          height: 6,
                          borderRadius: 3,
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--muted)',
                      textAlign: 'right',
                    }}
                  >
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Install snippet">
            <div
              className="mono"
              style={{
                marginTop: 14,
                padding: '12px 13px',
                borderRadius: 7,
                background: '#08080b',
                border: '1px solid rgba(255,255,255,.07)',
                fontSize: 11,
                lineHeight: 1.6,
                color: 'var(--muted)',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {
                '<script src="https://thp.dev/THP_analytics.js" data-project-id="abc123"></script>'
              }
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConnectionsTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card
        title="Data sources"
        aside={
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--accent-text)' }}
          >
            ADMIN ONLY
          </span>
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            marginTop: 16,
          }}
        >
          {connections.map((c) => (
            <div
              key={c.name}
              className={c.status === 'CONNECTED' ? 'panel' : 'dashed'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '13px 14px',
              }}
            >
              <span
                style={{
                  font: '400 12.5px var(--sans)',
                  color: 'rgba(237,237,240,.75)',
                }}
              >
                {c.name}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color:
                    c.status === 'CONNECTED'
                      ? 'var(--good)'
                      : 'var(--accent-text)',
                }}
              >
                {c.status}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 14,
            padding: '12px 13px',
            borderRadius: 7,
            background: 'rgba(123,92,224,.09)',
            font: '400 11px/1.5 var(--mono)',
            color: 'rgba(196,180,242,.85)',
          }}
        >
          Credentials are encrypted at rest via Secrets Manager. Role gate on
          credential writes.
        </div>
      </Card>

      <Card title="Poll activity">
        <div style={{ marginTop: 16 }}>
          {pollActivity.map((a) => (
            <div key={a.title} className="timeline-item">
              <div className="dot" style={{ background: a.tone }} />
              <div>
                <div
                  style={{
                    font: '400 12.5px var(--sans)',
                    color: 'rgba(237,237,240,.8)',
                  }}
                >
                  {a.title}
                </div>
                <div
                  className="mono faint"
                  style={{ fontSize: 11, marginTop: 3 }}
                >
                  {a.meta}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function DashboardPage({
  onProjects,
  onNewProject,
  onHowItWorks,
  onSignOut,
}: Props) {
  const [tab, setTab] = useState<Tab>('dev');

  return (
    <div>
      <TopBar
        projectName="portal-api"
        subtitle="thp/portal-api · eu-west-2 · thp.dev"
        onHowItWorks={onHowItWorks}
        onSignOut={onSignOut}
        onProjects={onProjects}
        onNewProject={onNewProject}
      />

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span
          className="mono faint"
          style={{ marginLeft: 'auto', fontSize: 11 }}
        >
          snapshot 14:00 · hourly poll
        </span>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 316px' }}
      >
        <main style={{ padding: '22px 26px 30px' }}>
          {tab === 'dev' && <DevTab />}
          {tab === 'post' && <PostDevTab />}
          {tab === 'telemetry' && <TelemetryTab />}
          {tab === 'connections' && <ConnectionsTab />}
        </main>

        <aside
          style={{
            borderLeft: '1px solid var(--border)',
            background: 'var(--panel-2)',
            padding: '22px 22px 30px',
          }}
        >
          <div className="label">Poll activity</div>
          <div style={{ marginTop: 16 }}>
            {pollActivity.map((a) => (
              <div key={a.title} className="timeline-item">
                <div className="dot" style={{ background: a.tone }} />
                <div>
                  <div
                    style={{
                      font: '400 12.5px var(--sans)',
                      color: 'rgba(237,237,240,.8)',
                    }}
                  >
                    {a.title}
                  </div>
                  <div
                    className="mono faint"
                    style={{ fontSize: 11, marginTop: 3 }}
                  >
                    {a.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: '1px solid var(--border)',
            }}
          >
            <div className="label">Connections</div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                marginTop: 14,
              }}
            >
              {connections.map((c) => (
                <div
                  key={c.name}
                  className={c.status === 'CONNECTED' ? 'panel' : 'dashed'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 13px',
                  }}
                >
                  <span
                    style={{
                      font: '400 12px var(--sans)',
                      color: 'rgba(237,237,240,.75)',
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color:
                        c.status === 'CONNECTED'
                          ? 'var(--good)'
                          : 'var(--accent-text)',
                    }}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 14,
                padding: '12px 13px',
                borderRadius: 7,
                background: 'rgba(123,92,224,.09)',
                font: '400 11px/1.5 var(--mono)',
                color: 'rgba(196,180,242,.85)',
              }}
            >
              admin only — role gate on credential writes
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
