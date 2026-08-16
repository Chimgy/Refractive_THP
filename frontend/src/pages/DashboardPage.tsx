import { useEffect, useState } from 'react';
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
import { useNavigate, useParams } from 'react-router-dom';
import * as projectsApi from '../api/projects';
import * as telemetryApi from '../api/telemetry';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import WorldMap, { countryName } from '../components/WorldMap';
import { BarRow, BigStat, VisualHead } from './MetricsPage';
import {
  connections as mockConnections,
  deploymentSeries,
  errorBudget,
  latencySeries,
  leadTimeBuckets,
  leadTimeSeries,
  pollActivity,
  utilisation,
} from '../data/mock';

type ConnectionEntry = { name: string; status: 'CONNECTED' | 'CONNECT' };

type Tab = 'dev' | 'post' | 'telemetry' | 'connections';

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

// n >= 1000 -> "31.4" + "k", otherwise a plain integer string with no unit.
function splitCompact(n: number): { value: string; unit?: string } {
  if (n >= 1000) return { value: (n / 1000).toFixed(1), unit: 'k' };
  return { value: n.toLocaleString() };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pctDeltaProps(
  pct: number | null,
  suffix: string,
): { delta?: string; deltaTone: 'good' | 'bad' | 'muted' } {
  if (pct === null) return { delta: suffix, deltaTone: 'muted' };
  const arrow = pct >= 0 ? '▲' : '▼';
  return {
    delta: `${arrow} ${Math.abs(pct).toFixed(1)}% ${suffix}`,
    deltaTone: pct >= 0 ? 'good' : 'bad',
  };
}

function msDeltaProps(deltaMs: number | null, suffix: string) {
  if (deltaMs === null) return { delta: suffix, deltaTone: 'muted' as const };
  const arrow = deltaMs >= 0 ? '▲' : '▼';
  const seconds = Math.round(Math.abs(deltaMs) / 1000);
  return {
    delta: `${arrow} ${seconds}s ${suffix}`,
    deltaTone: (deltaMs >= 0 ? 'good' : 'bad') as 'good' | 'bad',
  };
}

// Label + proportional bar + trailing value — the same row shape this file
// already hand-rolls once for tagged clicks; factored out so the new geo/
// device/scroll/UTM lists below don't each re-duplicate it.
function MiniBar({
  label,
  pct,
  value,
}: {
  label: string;
  pct: number;
  value: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 46px',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div>
        <div className="mono" style={{ fontSize: 11.5, color: 'rgba(237,237,240,.7)' }}>
          {label}
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
              width: `${Math.max(0, Math.min(100, pct))}%`,
              height: 6,
              borderRadius: 3,
              background: 'var(--accent)',
            }}
          />
        </div>
      </div>
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}
      >
        {value}
      </span>
    </div>
  );
}

// Top N entries by count, sharing the remainder into a synthetic "other" row
// rather than dropping it silently — used for any breakdown that can have
// more distinct keys than are worth listing (countries, UTM sources).
function rankedShares(
  entries: telemetryApi.TelemetryBreakdownEntry[],
  limit: number,
): { key: string; count: number; pct: number }[] {
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (total === 0) return [];
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, limit);
  const restCount = sorted.slice(limit).reduce((sum, e) => sum + e.count, 0);
  const rows = top.map((e) => ({
    key: e.key,
    count: e.count,
    pct: (e.count / total) * 100,
  }));
  if (restCount > 0) {
    rows.push({ key: 'other', count: restCount, pct: (restCount / total) * 100 });
  }
  return rows;
}

const DEVICE_ORDER = ['mobile', 'desktop', 'tablet'];

function TelemetryTab({
  projectId,
  refreshNonce,
}: {
  projectId: string;
  refreshNonce: number;
}) {
  const [uniques, setUniques] = useState<number | null>(null);
  const [uniquesFailed, setUniquesFailed] = useState(false);
  const [summary, setSummary] = useState<telemetryApi.TelemetrySummary | null>(
    null,
  );
  const [summaryFailed, setSummaryFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUniques(null);
    setUniquesFailed(false);
    setSummary(null);
    setSummaryFailed(false);

    telemetryApi
      .uniqueVisitors(projectId, 7)
      .then((res) => {
        if (!cancelled) setUniques(res.uniqueVisitors);
      })
      .catch(() => {
        if (!cancelled) setUniquesFailed(true);
      });

    telemetryApi
      .summary(projectId, 7)
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch(() => {
        if (!cancelled) setSummaryFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, refreshNonce]);

  const pageViewsStat = summary ? splitCompact(summary.pageViews) : null;
  const maxTaggedClick = Math.max(
    1,
    ...(summary?.taggedClicks.map((c) => c.count) ?? [1]),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="stat-strip">
        <Stat
          label="Page views 7d"
          value={pageViewsStat ? pageViewsStat.value : '—'}
          unit={pageViewsStat?.unit}
          {...(summaryFailed
            ? { delta: 'failed to load', deltaTone: 'bad' as const }
            : pctDeltaProps(summary?.pageViewsDeltaPct ?? null, 'vs prev 7d'))}
        />
        <Stat
          label="Unique visitors 7d"
          value={uniques === null ? '—' : uniques.toLocaleString()}
          delta={uniquesFailed ? 'failed to load' : 'live · Redis HLL'}
          deltaTone={uniquesFailed ? 'bad' : 'muted'}
        />
        <Stat
          label="Avg session"
          value={formatDuration(summary?.avgSessionMs ?? null)}
          {...(summaryFailed
            ? { delta: 'failed to load', deltaTone: 'bad' as const }
            : msDeltaProps(summary?.avgSessionDeltaMs ?? null, 'vs prev 7d'))}
        />
        <Stat
          label="Events 24h"
          value={summary ? summary.events24h.toLocaleString() : '—'}
          delta={summaryFailed ? 'failed to load' : 'batched ingest'}
          deltaTone={summaryFailed ? 'bad' : 'muted'}
        />
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
              data={summary?.series ?? []}
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
            style={{ display: 'grid', gridTemplateColumns: '1fr 100px' }}
          >
            <span>PATH</span>
            <span>VIEWS</span>
          </div>
          {(summary?.topPages ?? []).map((p) => (
            <div
              key={p.path}
              className="tr"
              style={{ gridTemplateColumns: '1fr 100px' }}
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
            </div>
          ))}
          {summary && summary.topPages.length === 0 ? (
            <div
              style={{
                padding: '16px 20px',
                font: '400 12px var(--sans)',
                color: 'var(--muted)',
              }}
            >
              No page views recorded yet.
            </div>
          ) : null}
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
              {(summary?.taggedClicks ?? []).map((c) => (
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
                          width: `${(c.count / maxTaggedClick) * 100}%`,
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
              {summary && summary.taggedClicks.length === 0 ? (
                <div
                  className="mono faint"
                  style={{ fontSize: 11, marginTop: 4 }}
                >
                  No data-thp-track clicks recorded yet.
                </div>
              ) : null}
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
                `<script src="https://thp.dev/THP_analytics.js" data-project-id="${projectId}"></script>`
              }
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Visitor geography"
        aside={
          <span className="mono faint" style={{ fontSize: 11 }}>
            country · CF-IPCountry
          </span>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 20,
            marginTop: 18,
          }}
        >
          <WorldMap data={summary?.countries ?? []} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {rankedShares(summary?.countries ?? [], 7).map((c) => (
              <MiniBar
                key={c.key}
                label={c.key === 'other' ? 'other' : countryName(c.key)}
                pct={c.pct}
                value={c.count.toLocaleString()}
              />
            ))}
            {summary && summary.countries.length === 0 ? (
              <div className="mono faint" style={{ fontSize: 11 }}>
                No geo data recorded yet.
              </div>
            ) : null}
          </div>
        </div>
        <div
          className="mono"
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'rgba(237,237,240,.35)',
          }}
        >
          country only · IP discarded
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card
          title="Device mix"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              sessions
            </span>
          }
        >
          {(() => {
            const total = (summary?.devices ?? []).reduce(
              (sum, d) => sum + d.count,
              0,
            );
            const byKey = new Map(
              (summary?.devices ?? []).map((d) => [d.key, d.count]),
            );
            if (total === 0) {
              return (
                <div className="mono faint" style={{ fontSize: 11, marginTop: 14 }}>
                  No device data recorded yet.
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
                {DEVICE_ORDER.map((key) => (
                  <MiniBar
                    key={key}
                    label={key}
                    pct={((byKey.get(key) ?? 0) / total) * 100}
                    value={`${(((byKey.get(key) ?? 0) / total) * 100).toFixed(0)}%`}
                  />
                ))}
              </div>
            );
          })()}
          {summary && summary.locales.length > 0 ? (
            <div
              className="mono"
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,.07)',
                fontSize: 11,
                color: 'rgba(237,237,240,.35)',
              }}
            >
              top locale {summary.locales[0].key} ·{' '}
              {(
                (summary.locales[0].count /
                  summary.locales.reduce((s, l) => s + l.count, 0)) *
                100
              ).toFixed(0)}
              %
            </div>
          ) : null}
        </Card>

        <Card
          title="Scroll depth"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              % of views
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
            {(summary?.scrollDepth ?? []).map((s) => (
              <MiniBar
                key={s.depth}
                label={`${s.depth}%`}
                pct={s.pct}
                value={`${s.pct.toFixed(0)}%`}
              />
            ))}
            {summary && summary.pageViews === 0 ? (
              <div className="mono faint" style={{ fontSize: 11 }}>
                No page views recorded yet.
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Card
          title="Largest Contentful Paint"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              p50 / p75
            </span>
          }
        >
          <VisualHead label="LCP P75" tag="" />
          <BigStat
            value={summary?.lcpP75 != null ? (summary.lcpP75 / 1000).toFixed(2) : '—'}
            unit={summary?.lcpP75 != null ? 's' : undefined}
            delta={summary?.lcpP50 != null ? `p50 ${Math.round(summary.lcpP50)}ms` : undefined}
          />
          <div
            style={{
              position: 'relative',
              height: 8,
              borderRadius: 4,
              marginTop: 16,
              background:
                'linear-gradient(90deg, var(--good) 0 42%, var(--warn) 42% 72%, var(--bad) 72% 100%)',
            }}
          >
            {summary?.lcpP75 != null ? (
              <div
                style={{
                  position: 'absolute',
                  top: -4,
                  left: `${Math.min(100, (summary.lcpP75 / 6000) * 100)}%`,
                  width: 2,
                  height: 16,
                  background: 'var(--text)',
                }}
              />
            ) : null}
          </div>
          <div
            className="mono"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              fontSize: 10.5,
              color: 'rgba(237,237,240,.35)',
            }}
          >
            <span>0s</span>
            <span>2.5s</span>
            <span>4.0s</span>
            <span>6s</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,.07)',
            }}
          >
            {summary?.lcpColdP75 != null || summary?.lcpCachedP75 != null ? (
              (() => {
                const cold = summary?.lcpColdP75 ?? 0;
                const cached = summary?.lcpCachedP75 ?? 0;
                const scale = Math.max(cold, cached, 1);
                return (
                  <>
                    <BarRow
                      label="COLD"
                      pct={(cold / scale) * 100}
                      value={summary?.lcpColdP75 != null ? `${(summary.lcpColdP75 / 1000).toFixed(2)}s` : '—'}
                      tone="var(--warn)"
                      labelWidth={64}
                    />
                    <BarRow
                      label="CACHED"
                      pct={(cached / scale) * 100}
                      value={summary?.lcpCachedP75 != null ? `${(summary.lcpCachedP75 / 1000).toFixed(2)}s` : '—'}
                      tone="var(--good)"
                      labelWidth={64}
                    />
                  </>
                );
              })()
            ) : (
              <div className="mono faint" style={{ fontSize: 11 }}>
                No cold/cached-labeled LCP samples yet.
              </div>
            )}
          </div>
        </Card>

        <Card
          title="Time to First Byte"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              p50 / p75
            </span>
          }
        >
          <VisualHead
            label="TTFB P75"
            tag={summary?.ttfbHitMs != null || summary?.ttfbMissMs != null ? 'BY CACHE' : ''}
          />
          <BigStat
            value={summary?.ttfbP75 != null ? String(Math.round(summary.ttfbP75)) : '—'}
            unit={summary?.ttfbP75 != null ? 'ms' : undefined}
            delta={summary?.ttfbP50 != null ? `p50 ${Math.round(summary.ttfbP50)}ms` : undefined}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
            {summary?.ttfbHitMs != null || summary?.ttfbMissMs != null ? (
              (() => {
                const hit = summary?.ttfbHitMs ?? 0;
                const miss = summary?.ttfbMissMs ?? 0;
                const scale = Math.max(hit, miss, 1);
                return (
                  <>
                    <BarRow
                      label="HIT"
                      pct={(hit / scale) * 100}
                      value={summary?.ttfbHitMs != null ? `${Math.round(summary.ttfbHitMs)}ms` : '—'}
                      tone="var(--good)"
                      labelWidth={64}
                    />
                    <BarRow
                      label="MISS"
                      pct={(miss / scale) * 100}
                      value={summary?.ttfbMissMs != null ? `${Math.round(summary.ttfbMissMs)}ms` : '—'}
                      tone="var(--warn)"
                      labelWidth={64}
                    />
                  </>
                );
              })()
            ) : (
              <div className="mono faint" style={{ fontSize: 11 }}>
                No cache-labeled TTFB samples yet — needs the Server-Timing
                cache-status entry to show up in real visits.
              </div>
            )}
          </div>
        </Card>

        <Card
          title="Dwell time"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              active bursts
            </span>
          }
        >
          <div style={{ display: 'flex', gap: 26, marginTop: 18 }}>
            <div>
              <div className="mono" style={{ fontSize: 20, color: 'var(--text)' }}>
                {formatDuration(summary?.dwellP50 ?? null)}
              </div>
              <div className="mono faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                median burst
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 20, color: 'var(--text)' }}>
                {formatDuration(summary?.dwellAvgMs ?? null)}
              </div>
              <div className="mono faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                avg burst
              </div>
            </div>
          </div>
          <div
            className="mono"
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,.07)',
              fontSize: 11,
              color: 'rgba(237,237,240,.35)',
            }}
          >
            per continuous active burst — pauses on tab-hide/30s idle, not
            full session length
          </div>
        </Card>
      </div>

      <Card
        title="Traffic sources (UTM)"
        aside={
          <span className="mono faint" style={{ fontSize: 11 }}>
            source
          </span>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
          {rankedShares(summary?.utmSources ?? [], 8).map((s) => (
            <MiniBar key={s.key} label={s.key} pct={s.pct} value={s.count.toLocaleString()} />
          ))}
          {summary && summary.utmSources.length === 0 ? (
            <div className="mono faint" style={{ fontSize: 11 }}>
              No utm_source parameters recorded yet.
            </div>
          ) : null}
        </div>
        <div
          className="mono"
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,.07)',
            fontSize: 11,
            color: 'rgba(237,237,240,.35)',
          }}
        >
          source only · medium/campaign not tracked · direct sessions not
          counted here
        </div>
      </Card>
    </div>
  );
}

function ConnectionsTab({ connections }: { connections: ConnectionEntry[] }) {
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { projectId, tab: tabParam } = useParams<{
    projectId: string;
    tab: string;
  }>();
  const tab = tabs.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'dev';
  const activeProjectId = projectId ?? 'portal-api';

  const [project, setProject] = useState<projectsApi.Project | null>(null);
  const [cloudflareLink, setCloudflareLink] =
    useState<projectsApi.CloudflareLinkStatus | null>(null);
  // Bumped by the header's Refresh button below — added to this effect's
  // deps (and TelemetryTab's own) purely to retrigger the same fetches on
  // demand, since nothing here polls on a timer otherwise.
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setProject(null);
    setCloudflareLink(null);
    projectsApi
      .get(activeProjectId)
      .then((res) => {
        if (!cancelled) setProject(res);
      })
      .catch(() => {
        // Header falls back to the raw id below — no need for a distinct
        // error state here, this bar is cosmetic.
      });
    // Config-presence check, not a live probe — see
    // CloudflareZoneLinkService.getStatus's own comment. Left null (not
    // "CONNECT") on failure below, same as project — the Connections widget
    // treats null as "still loading", not "definitely not connected".
    projectsApi
      .getCloudflareLinkStatus(activeProjectId)
      .then((res) => {
        if (!cancelled) setCloudflareLink(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, refreshNonce]);

  // Telemetry SDK is "configured" if the project has at least one allowed
  // origin set — an input that exists, not a live check that the embed
  // script is actually firing events. Cloudflare is real the same way (a
  // linked zone, not a reachability probe). GitHub/AWS CloudWatch stay mock
  // — those integrations don't exist in this codebase yet.
  const connections: ConnectionEntry[] = [
    {
      name: 'Telemetry SDK',
      status:
        project && project.allowedOrigins.length > 0 ? 'CONNECTED' : 'CONNECT',
    },
    {
      name: 'Cloudflare',
      status: cloudflareLink?.linked ? 'CONNECTED' : 'CONNECT',
    },
    ...mockConnections.filter(
      (c) => c.name === 'GitHub' || c.name === 'AWS CloudWatch',
    ),
  ];

  return (
    <div
      style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
    >
      <SiteHeader
        project={{
          name: project?.name ?? activeProjectId,
          subtitle: project
            ? (project.allowedOrigins[0] ?? 'no origin configured')
            : 'loading…',
        }}
        actions={
          <>
            <button
              type="button"
              className="btn"
              style={{ height: 30 }}
              onClick={() => navigate('/projects/new')}
            >
              + New project
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ height: 30 }}
              onClick={() => setRefreshNonce((n) => n + 1)}
            >
              Refresh
            </button>
          </>
        }
      />

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => navigate(`/projects/${projectId}/${t.id}`)}
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
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 316px',
        }}
      >
        <main style={{ padding: '22px 26px 30px' }}>
          {tab === 'dev' && <DevTab />}
          {tab === 'post' && <PostDevTab />}
          {tab === 'telemetry' && (
            <TelemetryTab
              projectId={activeProjectId}
              refreshNonce={refreshNonce}
            />
          )}
          {tab === 'connections' && (
            <ConnectionsTab connections={connections} />
          )}
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

      <SiteFooter />
    </div>
  );
}
