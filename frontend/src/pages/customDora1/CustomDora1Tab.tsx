import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../auth/AuthContext';
import * as projectsApi from '../../api/projects';
import { seedFromString } from '../../widgets/mockSeeded';
import { LegendSwatch } from '../../widgets/dora/DoraChartBits';
import {
  axis,
  DEPLOY_COUNT,
  distributionFor,
  generateDeploys,
  generateIncidents,
  generateSeries,
  HOVER_CURSOR,
  hrs,
  INCIDENT_COUNT,
  jitterStages,
  METRIC_OPTIONS,
  METRICS,
  RANGE_OPTIONS,
  SEV_TONE,
  STAGES,
  STATUS_TONE,
  tooltipStyle,
  type MetricId,
  type Range,
} from '../../widgets/dora/doraShared';

// ---------------------------------------------------------------------------
// DORA (deployment frequency / lead time / change failure rate / MTTR) tab.
// Static panels, no drag/resize — recreated from the customDora1/DORA
// Dashboard.dc.html design reference using the app's existing CSS classes
// (panel/stat-strip/thead/tr/pill/select/range/note) and recharts. Data
// generators live in widgets/dora/doraShared.ts.
// ---------------------------------------------------------------------------

const TEAM_OPTIONS = ['All teams', 'Platform', 'Growth', 'Infra'];
const REPO_OPTIONS = ['All repos', 'refractive/api', 'refractive/portal'];

function PanelHead({
  title,
  subtitle,
  aside,
  divider = true,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 18px 12px',
        borderBottom: divider ? '1px solid var(--border)' : undefined,
      }}
    >
      <div>
        <div className="card-title" style={{ fontSize: 14.5 }}>
          {title}
        </div>
        {subtitle ? (
          <div
            className="mono faint"
            style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45 }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * 120;
    const y = 26 - ((v - min) / span) * 22;
    return [x, y] as const;
  });
  const [lastX, lastY] = points[points.length - 1];
  return (
    <svg
      viewBox="0 0 120 30"
      preserveAspectRatio="none"
      height={30}
      style={{
        overflow: 'visible',
        width: '100%',
        maxWidth: 104,
        minWidth: 44,
      }}
    >
      <polyline
        points={points
          .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
          .join(' ')}
        fill="none"
        stroke={tone}
        strokeWidth={1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={2.2} fill={tone} />
    </svg>
  );
}

function ScoreCard({
  abbr,
  name,
  value,
  unit,
  tier,
  tierTone,
  delta,
  deltaTone,
  target,
  sparkValues,
  sparkTone,
}: {
  abbr: string;
  name: string;
  value: string;
  unit: string;
  tier: string;
  tierTone: { bg: string; fg: string };
  delta: string;
  deltaTone: 'good' | 'bad';
  target: string;
  sparkValues: number[];
  sparkTone: string;
}) {
  return (
    <div
      className="stat"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 0,
          }}
        >
          <span className="label">{abbr}</span>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {name}
          </span>
        </div>
        <span
          className="pill"
          style={{
            background: tierTone.bg,
            color: tierTone.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {tier}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            className="mono"
            style={{ fontSize: 27, letterSpacing: '-.02em' }}
          >
            {value}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(237,237,240,.4)' }}>
            {unit}
          </span>
        </div>
        <Sparkline values={sparkValues} tone={sparkTone} />
      </div>
      <div
        className="mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: 10.5,
        }}
      >
        <span className={deltaTone === 'good' ? 'delta-good' : 'delta-bad'}>
          {delta} vs prev
        </span>
        <span className="faint">target {target}</span>
      </div>
    </div>
  );
}

const TIER_TONE = {
  Elite: { bg: 'rgba(53,192,138,.14)', fg: 'var(--good)' },
  High: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)' },
  Medium: { bg: 'rgba(224,163,59,.14)', fg: 'var(--warn)' },
};

export default function CustomDora1Tab({
  projectId,
}: {
  projectId: string;
  refreshNonce: number;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<projectsApi.Project[] | null>(null);
  const [range, setRange] = useState<Range>('90d');
  const [metricId, setMetricId] = useState<MetricId>('ltc');

  useEffect(() => {
    let cancelled = false;
    projectsApi
      .list()
      .then((res) => {
        if (!cancelled) setProjects(res);
      })
      .catch(() => {
        // Scope bar falls back to just the active project below — cosmetic,
        // not worth a distinct error state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seed = seedFromString(projectId);
  const series = useMemo(() => generateSeries(range, seed), [range, seed]);
  const stages = useMemo(() => jitterStages(seed), [seed]);
  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];
  const distribution = useMemo(
    () => distributionFor(metric, seed),
    [metric, seed],
  );
  const deploys = useMemo(() => generateDeploys(seed), [seed]);
  const incidents = useMemo(() => generateIncidents(seed), [seed]);

  const totalHours = stages.reduce((sum, s) => sum + s.hours, 0);
  const worstStage = stages.reduce(
    (a, s) => (s.hours > a.hours ? s : a),
    stages[0],
  );
  const last = series[series.length - 1];

  const composedData = useMemo(
    () => series.map((b) => ({ label: b.label, df: b.df, cfr: b.cfr })),
    [series],
  );
  const stackedData = useMemo(
    () => series.map((b) => ({ label: b.label, ...b.stack })),
    [series],
  );

  const updatedAt = useMemo(
    () =>
      new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [],
  );

  const activeProject = projects?.find((p) => p.id === projectId);
  const deployTableCols =
    'minmax(0,1.3fr) minmax(0,1.05fr) 44px 44px 44px 52px 84px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Page head + scope filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span className="label">DORA metrics</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <h1 style={{ fontSize: 23, letterSpacing: '-.01em' }}>
              Delivery performance
            </h1>
            <span className="pill pill-dev">High overall</span>
          </div>
          <div className="mono faint" style={{ fontSize: 11.5 }}>
            {DEPLOY_COUNT} deployments · {INCIDENT_COUNT} incidents · window{' '}
            {range} · updated {updatedAt} UTC
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="label" style={{ fontSize: 9.5 }}>
              Org
            </span>
            <select className="select" value={user?.companyName ?? ''} disabled>
              <option>{user?.companyName ?? 'Loading…'}</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="label" style={{ fontSize: 9.5 }}>
              Project
            </span>
            <select
              className="select"
              value={projectId}
              onChange={(e) => {
                const next = e.target.value;
                if (next !== projectId)
                  navigate(`/projects/${next}/customDora1`);
              }}
            >
              {activeProject ? null : (
                <option value={projectId}>{projectId}</option>
              )}
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="label" style={{ fontSize: 9.5 }}>
              Team
            </span>
            <select className="select" defaultValue={TEAM_OPTIONS[0]}>
              {TEAM_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="label" style={{ fontSize: 9.5 }}>
              Repo
            </span>
            <select className="select" defaultValue={REPO_OPTIONS[0]}>
              {REPO_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="label" style={{ fontSize: 9.5 }}>
              Window
            </span>
            <div className="range" style={{ height: 34, alignItems: 'center' }}>
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={r.value === range ? 'on' : ''}
                  onClick={() => setRange(r.value)}
                >
                  {r.label.replace(' days', 'D').replace(' year', 'Y')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard strip */}
      <div className="stat-strip">
        <ScoreCard
          abbr="DF"
          name="Deployment frequency"
          value={last.df.toFixed(1)}
          unit="/ day"
          tier="Elite"
          tierTone={TIER_TONE.Elite}
          delta="+18%"
          deltaTone="good"
          target="≥ 1/day"
          sparkValues={series.map((b) => b.df)}
          sparkTone="var(--accent)"
        />
        <ScoreCard
          abbr="LTC"
          name="Lead time for changes"
          value={hrs(totalHours)}
          unit="P50"
          tier="High"
          tierTone={TIER_TONE.High}
          delta="−11%"
          deltaTone="good"
          target="< 24h"
          sparkValues={series
            .map((b) => STAGES.reduce((sum, s) => sum + b.stack[s.key], 0))
            .reverse()}
          sparkTone="var(--accent)"
        />
        <ScoreCard
          abbr="CFR"
          name="Change failure rate"
          value={`${last.cfr.toFixed(0)}%`}
          unit="of deploys"
          tier="High"
          tierTone={TIER_TONE.High}
          delta="−4.2pp"
          deltaTone="good"
          target="≤ 15%"
          sparkValues={series.map((b) => b.cfr)}
          sparkTone="var(--bad)"
        />
        <ScoreCard
          abbr="MTTR"
          name="Failed deploy recovery"
          value="2.4"
          unit="h P50"
          tier="Medium"
          tierTone={TIER_TONE.Medium}
          delta="+34m"
          deltaTone="bad"
          target="< 1h"
          sparkValues={[1.2, 1.6, 1.4, 2.1, 1.9, 2.6, 2.4]}
          sparkTone="var(--warn)"
        />
      </div>

      {/* Speed vs stability + where lead time sits */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}
      >
        <div
          className="panel"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <PanelHead
            title="Speed vs stability"
            subtitle="Deployment frequency against change failure rate — dual axis, never read alone."
            aside={
              <div
                className="mono muted"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  fontSize: 10.5,
                  flex: 'none',
                }}
              >
                <LegendSwatch label="deploys/day" tone="#7b5ce0" />
                <LegendSwatch label="CFR %" tone="#e2564d" shape="line" />
              </div>
            }
          />
          <div style={{ padding: '16px 18px 14px', height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={composedData}
                margin={{ top: 4, right: 4, bottom: 0, left: -4 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,.055)"
                  vertical={false}
                />
                <XAxis dataKey="label" {...axis} />
                <YAxis yAxisId="df" domain={[0, 4]} {...axis} width={26} />
                <YAxis
                  yAxisId="cfr"
                  orientation="right"
                  domain={[0, 40]}
                  tickFormatter={(v: number) => `${v}%`}
                  {...axis}
                  stroke="rgba(226,86,77,.7)"
                  width={34}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={HOVER_CURSOR}
                  formatter={(value, name) =>
                    name === 'CFR %'
                      ? [`${Number(value).toFixed(0)}%`, name]
                      : [Number(value).toFixed(2), name]
                  }
                />
                <Bar
                  yAxisId="df"
                  dataKey="df"
                  name="deploys/day"
                  fill="#7b5ce0"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={34}
                />
                <Line
                  yAxisId="cfr"
                  dataKey="cfr"
                  name="CFR %"
                  stroke="#e2564d"
                  strokeWidth={1.75}
                  dot={{
                    r: 3,
                    fill: '#0f0f14',
                    stroke: '#e2564d',
                    strokeWidth: 1.5,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="panel"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <PanelHead
            title="Where lead time sits"
            subtitle="Commit → production, split by stage."
          />
          <div
            style={{
              padding: '16px 18px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                className="mono"
                style={{ fontSize: 27, letterSpacing: '-.02em' }}
              >
                {hrs(totalHours)}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(237,237,240,.4)' }}>
                P50 end to end · P95 {hrs(142)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                height: 20,
                borderRadius: 4,
                overflow: 'hidden',
                background: 'rgba(255,255,255,.06)',
              }}
            >
              {stages.map((s) => (
                <div
                  key={s.key}
                  style={{
                    width: `${(s.hours / totalHours) * 100}%`,
                    background: s.tone,
                  }}
                />
              ))}
            </div>
            <div>
              <div
                className="mono faint"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) 52px 52px 40px',
                  gap: 8,
                  paddingBottom: 9,
                  fontSize: 10,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                }}
              >
                <span>Stage</span>
                <span style={{ textAlign: 'right' }}>P50</span>
                <span style={{ textAlign: 'right' }}>P95</span>
                <span style={{ textAlign: 'right' }}>Share</span>
              </div>
              {stages.map((s) => (
                <div
                  key={s.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) 52px 52px 40px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '10px 0',
                    borderTop: '1px solid rgba(255,255,255,.05)',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12.5,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: s.tone,
                        flex: 'none',
                      }}
                    />
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.name}
                    </span>
                    {s.key === worstStage.key ? (
                      <span
                        className="pill"
                        style={{
                          background: 'rgba(226,86,77,.14)',
                          color: 'var(--bad)',
                          fontSize: 9.5,
                          flex: 'none',
                        }}
                      >
                        SLOW
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="mono"
                    style={{ textAlign: 'right', fontSize: 12.5 }}
                  >
                    {hrs(s.hours)}
                  </span>
                  <span
                    className="mono muted"
                    style={{ textAlign: 'right', fontSize: 12.5 }}
                  >
                    {hrs(s.p95)}
                  </span>
                  <span
                    className="mono faint"
                    style={{ textAlign: 'right', fontSize: 12.5 }}
                  >
                    {Math.round((s.hours / totalHours) * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="note" style={{ marginTop: 'auto' }}>
              {worstStage.name} holds{' '}
              {Math.round((worstStage.hours / totalHours) * 100)}% of median
              lead time and the widest P50→P95 spread ({hrs(worstStage.hours)} →{' '}
              {hrs(worstStage.p95)}). The queue, not the work, is the
              constraint.
            </div>
          </div>
        </div>
      </div>

      {/* Lead time by stage per week + distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div
          className="panel"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <PanelHead
            title="Lead time by stage, per week"
            subtitle="Stacked P50 hours — watch which band grows."
            aside={
              <div
                className="mono muted"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  fontSize: 10,
                  maxWidth: 190,
                  justifyContent: 'flex-end',
                }}
              >
                {STAGES.map((s) => (
                  <LegendSwatch key={s.key} label={s.short} tone={s.tone} />
                ))}
              </div>
            }
          />
          <div style={{ padding: '16px 18px 14px', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackedData}
                margin={{ top: 4, right: 4, bottom: 0, left: -4 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,.055)"
                  vertical={false}
                />
                <XAxis dataKey="label" {...axis} />
                <YAxis
                  domain={[0, 48]}
                  tickFormatter={(v: number) => `${v}h`}
                  {...axis}
                  width={30}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={HOVER_CURSOR}
                  formatter={(v) => hrs(Number(v))}
                />
                {STAGES.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stackId="stage"
                    fill={s.tone}
                    maxBarSize={34}
                    radius={i === STAGES.length - 1 ? [3, 3, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="panel"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <PanelHead
            title={`${metric.title} distribution`}
            subtitle="Every event in the window, binned — log-scaled x, so the tail is visible."
            aside={
              <div className="range" style={{ gap: 4, flex: 'none' }}>
                {METRIC_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={m.value === metricId ? 'on' : ''}
                    onClick={() => setMetricId(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            }
          />
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {distribution.stats.map((s) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  minWidth: 96,
                  padding: '11px 18px',
                  borderRight: '1px solid rgba(255,255,255,.05)',
                }}
              >
                <div className="label" style={{ fontSize: 9.5 }}>
                  {s.label}
                </div>
                <div
                  className="mono"
                  style={{ marginTop: 5, fontSize: 15, color: s.tone }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 18px 4px', height: 158 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distribution.hist}
                margin={{ top: 16, right: 4, bottom: 0, left: -4 }}
                barCategoryGap="8%"
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,.055)"
                  vertical={false}
                />
                <XAxis dataKey="label" {...axis} fontSize={9} />
                <YAxis hide domain={[0, 'dataMax']} />
                <Tooltip contentStyle={tooltipStyle} cursor={HOVER_CURSOR} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {distribution.hist.map((b, i) => (
                    <Cell key={i} fill={b.tone} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="top"
                    formatter={(v) => (v ? v : '')}
                    style={{
                      fontSize: 9.5,
                      fill: 'rgba(237,237,240,.5)',
                      fontFamily: 'var(--mono)',
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              marginTop: 'auto',
              padding: '12px 18px 16px',
              borderTop: '1px solid rgba(255,255,255,.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span className="label" style={{ fontSize: 9.5 }}>
                Raw sample · one mark per event
              </span>
              <span className="mono faint" style={{ fontSize: 10.5 }}>
                n = {metric.n}
              </span>
            </div>
            <div
              style={{
                position: 'relative',
                height: 34,
                marginTop: 9,
                borderRadius: 5,
                background: 'rgba(255,255,255,.03)',
              }}
            >
              {distribution.rug.map((p, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: p.y,
                    width: 3,
                    height: 3,
                    marginLeft: -1.5,
                    borderRadius: '50%',
                    background: p.tone,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Deployment history + incidents */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.45fr 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div className="panel" style={{ overflow: 'hidden' }}>
          <PanelHead
            title="Deployment history"
            subtitle="Every production release with per-stage timings."
            divider={false}
            aside={
              <span
                className="mono"
                style={{
                  fontSize: 11.5,
                  color: 'var(--accent-text)',
                  flex: 'none',
                }}
              >
                all {DEPLOY_COUNT} →
              </span>
            }
          />
          <div
            className="thead"
            style={{
              display: 'grid',
              gridTemplateColumns: deployTableCols,
              gap: 8,
              borderTop: '1px solid var(--border)',
            }}
          >
            <span>Deploy</span>
            <span>Service</span>
            <span style={{ textAlign: 'right' }}>Code</span>
            <span style={{ textAlign: 'right' }}>Rev</span>
            <span style={{ textAlign: 'right' }}>CI</span>
            <span style={{ textAlign: 'right' }}>Lead</span>
            <span>Outcome</span>
          </div>
          {deploys.map((d) => {
            const tone = STATUS_TONE[d.status];
            return (
              <div
                key={d.sha}
                className="tr"
                style={{ gridTemplateColumns: deployTableCols, gap: 8 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 12 }}>
                    {d.sha}
                  </div>
                  <div
                    className="mono faint"
                    style={{
                      marginTop: 3,
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {d.meta}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12.5,
                    color: 'rgba(237,237,240,.75)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.service}
                </span>
                <span
                  className="mono muted"
                  style={{ textAlign: 'right', fontSize: 12 }}
                >
                  {d.coding}
                </span>
                <span
                  className="mono"
                  style={{
                    textAlign: 'right',
                    fontSize: 12,
                    color: d.reviewTone,
                  }}
                >
                  {d.review}
                </span>
                <span
                  className="mono muted"
                  style={{ textAlign: 'right', fontSize: 12 }}
                >
                  {d.ci}
                </span>
                <span
                  className="mono"
                  style={{ textAlign: 'right', fontSize: 12.5 }}
                >
                  {d.lead}
                </span>
                <span>
                  <span
                    className="pill"
                    style={{
                      background: tone.bg,
                      color: tone.fg,
                      fontSize: 10,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.status}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="panel" style={{ overflow: 'hidden' }}>
          <PanelHead
            title="Incidents & recovery"
            subtitle="Detect → mitigate → restored, per incident."
            divider={false}
          />
          {incidents.map((i) => {
            const tone = SEV_TONE[i.sev];
            return (
              <div
                key={i.id}
                style={{
                  padding: '13px 18px',
                  borderTop: '1px solid rgba(255,255,255,.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <span
                      className="pill"
                      style={{
                        background: tone.bg,
                        color: tone.fg,
                        fontSize: 9.5,
                        flex: 'none',
                      }}
                    >
                      {i.sev}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {i.service}
                    </span>
                  </span>
                  <span className="mono" style={{ fontSize: 14, flex: 'none' }}>
                    {i.mttr}
                  </span>
                </div>
                <div
                  className="mono faint"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    fontSize: 10.5,
                  }}
                >
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {i.id} · {i.trigger}
                  </span>
                  <span style={{ flex: 'none' }}>
                    detect {i.detected} · fix {i.fix}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    height: 5,
                    borderRadius: 3,
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,.06)',
                  }}
                >
                  <div
                    style={{
                      width: `${i.detectPct}%`,
                      background: 'var(--warn)',
                    }}
                  />
                  <div
                    style={{ width: `${i.fixPct}%`, background: 'var(--bad)' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
