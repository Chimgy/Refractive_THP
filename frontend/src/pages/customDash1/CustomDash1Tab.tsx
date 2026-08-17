import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as telemetryApi from '../../api/telemetry';
import WorldMap, { countryName } from '../../components/WorldMap';
import DashboardGrid, { type DragHandleProps } from '../../widgets/grid/DashboardGrid';
import { usePersistedWidgets } from '../../widgets/grid/usePersistedWidgets';
import AddWidgetPicker from '../../widgets/common/AddWidgetPicker';
import { getWidgetRegistryEntry } from '../../widgets/registry';
import DauWauMauWidget from '../../widgets/dauWauMau/DauWauMauWidget';
import { defaultDauWauMauConfig } from '../../widgets/dauWauMau/config';
import GrowthIndicatorWidget from '../../widgets/growthIndicator/GrowthIndicatorWidget';
import { defaultGrowthIndicatorConfig } from '../../widgets/growthIndicator/config';
import RetentionWidget from '../../widgets/retention/RetentionWidget';
import { defaultRetentionConfig } from '../../widgets/retention/config';
import MarketingFunnelWidget from '../../widgets/marketingFunnel/MarketingFunnelWidget';
import { defaultMarketingFunnelConfig } from '../../widgets/marketingFunnel/config';
import type { DashboardWidgetInstance } from '../../widgets/dashboardWidgetTypes';
import { BarRow, BigStat, VisualHead } from '../MetricsPage';

// ---------------------------------------------------------------------------
// New: a hand-rolled snap grid of modular, resizable widgets.
// ---------------------------------------------------------------------------

function defaultWidgets(projectId: string): DashboardWidgetInstance[] {
  return [
    {
      id: 'dau-wau-mau-1',
      type: 'dau_wau_mau',
      title: 'Daily / Weekly / Monthly active users',
      layout: { x: 0, y: 0, w: 7, h: 9 },
      config: defaultDauWauMauConfig(`${projectId}:dau-wau-mau-1`),
    },
    {
      id: 'growth-indicator-1',
      type: 'growth_indicator',
      title: 'Growth Indicator',
      layout: { x: 7, y: 0, w: 5, h: 9 },
      config: defaultGrowthIndicatorConfig(`${projectId}:growth-indicator-1`),
    },
    {
      id: 'retention-1',
      type: 'retention',
      title: 'Retention',
      layout: { x: 0, y: 9, w: 6, h: 10 },
      config: defaultRetentionConfig(`${projectId}:retention-1`),
    },
    {
      id: 'marketing-funnel-1',
      type: 'marketing_funnel',
      title: 'Marketing Funnel',
      layout: { x: 6, y: 9, w: 6, h: 10 },
      config: defaultMarketingFunnelConfig(`${projectId}:marketing-funnel-1`),
    },
  ];
}

function getConstraints(widget: DashboardWidgetInstance) {
  const entry = getWidgetRegistryEntry(widget.type);
  return entry ?? { minW: 2, minH: 3, maxW: 12, maxH: 40 };
}

export default function CustomDash1Tab({
  projectId,
  refreshNonce,
}: {
  projectId: string;
  refreshNonce: number;
}) {
  const [widgets, setWidgets] = usePersistedWidgets<DashboardWidgetInstance>(
    `thp:dashboard:${projectId}:customDash1:layout:v3`,
    useMemo(() => defaultWidgets(projectId), [projectId]),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleUpdateWidget = useCallback(
    (next: DashboardWidgetInstance) => {
      setWidgets(widgets.map((w) => (w.id === next.id ? next : w)));
    },
    [widgets, setWidgets],
  );

  const handleDuplicateWidget = useCallback(
    (instance: DashboardWidgetInstance) => {
      const maxY = Math.max(0, ...widgets.map((w) => w.layout.y + w.layout.h));
      const clone = {
        ...instance,
        id: `${instance.type}-${Date.now()}`,
        title: `${instance.title} (copy)`,
        layout: { ...instance.layout, x: 0, y: maxY },
      } as DashboardWidgetInstance;
      setWidgets([...widgets, clone]);
    },
    [widgets, setWidgets],
  );

  const handleAddWidget = useCallback(
    (type: string) => {
      const entry = getWidgetRegistryEntry(type);
      if (!entry) return;
      const maxY = Math.max(0, ...widgets.map((w) => w.layout.y + w.layout.h));
      const instance = {
        id: `${type}-${Date.now()}`,
        type,
        title: entry.label,
        layout: { x: 0, y: maxY, w: entry.defaultW, h: entry.defaultH },
        config: entry.createDefaultConfig(`${projectId}:${type}-${Date.now()}`),
      } as unknown as DashboardWidgetInstance;
      setWidgets([...widgets, instance]);
      setPickerOpen(false);
    },
    [widgets, setWidgets, projectId],
  );

  const handleRemoveWidget = useCallback(
    (id: string) => setWidgets(widgets.filter((w) => w.id !== id)),
    [widgets, setWidgets],
  );

  // Each widget component's own onUpdate/onDuplicate props are typed against
  // its own specific config (so the widget stays portable on its own,
  // independent of this app's DashboardWidgetInstance union) — the casts
  // here just bridge back to the union that actually gets persisted.
  const renderWidget = useCallback(
    (widget: DashboardWidgetInstance, dragHandleProps: DragHandleProps) => {
      switch (widget.type) {
        case 'dau_wau_mau':
          return (
            <DauWauMauWidget
              instance={widget}
              onUpdate={(next) => handleUpdateWidget(next as DashboardWidgetInstance)}
              onDuplicate={(inst) => handleDuplicateWidget(inst as DashboardWidgetInstance)}
              onRemove={handleRemoveWidget}
              dragHandleProps={dragHandleProps}
            />
          );
        case 'growth_indicator':
          return (
            <GrowthIndicatorWidget
              instance={widget}
              onUpdate={(next) => handleUpdateWidget(next as DashboardWidgetInstance)}
              onDuplicate={(inst) => handleDuplicateWidget(inst as DashboardWidgetInstance)}
              onRemove={handleRemoveWidget}
              dragHandleProps={dragHandleProps}
            />
          );
        case 'retention':
          return (
            <RetentionWidget
              instance={widget}
              onUpdate={(next) => handleUpdateWidget(next as DashboardWidgetInstance)}
              onDuplicate={(inst) => handleDuplicateWidget(inst as DashboardWidgetInstance)}
              onRemove={handleRemoveWidget}
              dragHandleProps={dragHandleProps}
            />
          );
        case 'marketing_funnel':
          return (
            <MarketingFunnelWidget
              instance={widget}
              onUpdate={(next) => handleUpdateWidget(next as DashboardWidgetInstance)}
              onDuplicate={(inst) => handleDuplicateWidget(inst as DashboardWidgetInstance)}
              onRemove={handleRemoveWidget}
              dragHandleProps={dragHandleProps}
            />
          );
        default:
          return null;
      }
    },
    [handleUpdateWidget, handleDuplicateWidget, handleRemoveWidget],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="card-title" style={{ fontSize: 15 }}>
            Custom Dashboard 1
          </span>
          <span className="mono faint" style={{ fontSize: 10.5 }}>
            drag a header to reposition · drag a corner to resize
          </span>
        </div>
        <button type="button" className="btn" onClick={() => setPickerOpen(true)}>
          + Add widget
        </button>
      </div>

      <DashboardGrid
        widgets={widgets}
        onLayoutChange={setWidgets}
        getConstraints={getConstraints}
        renderWidget={renderWidget}
      />

      {pickerOpen && (
        <AddWidgetPicker onCancel={() => setPickerOpen(false)} onPick={handleAddWidget} />
      )}

      <div
        style={{
          marginTop: 8,
          paddingTop: 16,
          borderTop: '1px dashed var(--border-strong)',
        }}
      >
        <div className="mono faint" style={{ fontSize: 10.5, marginBottom: 14 }}>
          legacy telemetry copy — pasted from the Telemetry tab, not yet
          migrated onto the grid above
        </div>
        <LegacyTelemetryCopy projectId={projectId} refreshNonce={refreshNonce} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Below: a verbatim copy of DashboardPage.tsx's TelemetryTab (and the small
// helpers it needs), so this scratch tab has real reference data to build
// against without touching the live-wired Telemetry tab. Per the request
// this is a straight copy-paste, not refactored to share code with
// DashboardPage.tsx.
// ---------------------------------------------------------------------------

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

function formatSeconds(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
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

const msFmt = (v: number | null) => (v != null ? `${Math.round(v)}ms` : '—');

// One split-bucket row (TTFB's HIT/MISS, LCP's COLD/CACHED, ...): an
// optional sample count, a bar scaled off p50 (so the buckets stay visually
// comparable), and the full p50/p75/p99 spread underneath so the headline
// number isn't the only percentile shown.
function PercentileCacheBlock({
  label,
  count,
  p50,
  p75,
  p99,
  pct,
  tone,
  fmt = msFmt,
}: {
  label: string;
  count?: number;
  p50: number | null;
  p75: number | null;
  p99: number | null;
  pct: number;
  tone: string;
  fmt?: (v: number | null) => string;
}) {
  return (
    <div>
      <BarRow
        label={count != null ? `${label} · ${count.toLocaleString()}` : label}
        pct={pct}
        value={fmt(p50)}
        tone={tone}
        labelWidth={110}
      />
      <div
        className="mono faint"
        style={{ fontSize: 10, marginLeft: 122, marginTop: 4, display: 'flex', gap: 12 }}
      >
        <span>p50 {fmt(p50)}</span>
        <span>p75 {fmt(p75)}</span>
        <span>p99 {fmt(p99)}</span>
      </div>
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

function LegacyTelemetryCopy({
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

  const [errors, setErrors] = useState<telemetryApi.ErrorFingerprint[] | null>(
    null,
  );
  const [errorsFailed, setErrorsFailed] = useState(false);
  const [expandedFingerprint, setExpandedFingerprint] = useState<
    string | null
  >(null);
  const [snapshotsByFingerprint, setSnapshotsByFingerprint] = useState<
    Record<string, telemetryApi.ErrorSnapshot[] | 'loading' | 'failed'>
  >({});

  useEffect(() => {
    let cancelled = false;
    setUniques(null);
    setUniquesFailed(false);
    setSummary(null);
    setSummaryFailed(false);
    setErrors(null);
    setErrorsFailed(false);
    setExpandedFingerprint(null);
    setSnapshotsByFingerprint({});

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

    telemetryApi
      .listErrors(projectId)
      .then((res) => {
        if (!cancelled) setErrors(res);
      })
      .catch(() => {
        if (!cancelled) setErrorsFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, refreshNonce]);

  function toggleErrorRow(fingerprint: string) {
    if (expandedFingerprint === fingerprint) {
      setExpandedFingerprint(null);
      return;
    }
    setExpandedFingerprint(fingerprint);
    if (snapshotsByFingerprint[fingerprint]) return;
    setSnapshotsByFingerprint((prev) => ({
      ...prev,
      [fingerprint]: 'loading',
    }));
    telemetryApi
      .errorSnapshots(projectId, fingerprint)
      .then((res) => {
        setSnapshotsByFingerprint((prev) => ({ ...prev, [fingerprint]: res }));
      })
      .catch(() => {
        setSnapshotsByFingerprint((prev) => ({
          ...prev,
          [fingerprint]: 'failed',
        }));
      });
  }

  const pageViewsStat = summary ? splitCompact(summary.pageViews) : null;
  const maxTaggedClick = Math.max(
    1,
    ...(summary?.taggedClicks.map((c) => c.count) ?? [1]),
  );

  const attentionPct =
    summary?.avgSessionMs != null &&
    summary?.sessionWallAvgMs != null &&
    summary.sessionWallAvgMs > 0
      ? Math.min(100, (summary.avgSessionMs / summary.sessionWallAvgMs) * 100)
      : null;

  const pagesPerSession =
    summary && summary.sessions > 0
      ? summary.pageViews / summary.sessions
      : null;

  // DNS/TCP are individual phase durations; domContentLoaded/loadComplete
  // are cumulative-from-navigation-start timestamps, so the DOM-load and
  // complete segments below are the remainder after subtracting everything
  // before them — a waterfall decomposition, not four independent samples.
  const navPhases = (() => {
    const dns = summary?.dnsColdP50;
    const tcp = summary?.tcpColdP50;
    const dom = summary?.domContentLoadedColdP50;
    const complete = summary?.loadCompleteColdP50;
    if (dns == null || tcp == null || dom == null || complete == null) {
      return null;
    }
    const domPhase = Math.max(0, dom - dns - tcp);
    const completePhase = Math.max(0, complete - dom);
    const total = Math.max(1, dns + tcp + domPhase + completePhase);
    return {
      dns,
      tcp,
      dom: domPhase,
      complete,
      dnsPct: (dns / total) * 100,
      tcpPct: (tcp / total) * 100,
      domPct: (domPhase / total) * 100,
      completePct: (completePhase / total) * 100,
    };
  })();

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
          label="Median session"
          value={formatDuration(summary?.sessionWallP50 ?? null)}
          delta={summaryFailed ? 'failed to load' : 'wall clock · median, outlier-resistant'}
          deltaTone={summaryFailed ? 'bad' : 'muted'}
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
          <VisualHead
            label="LCP P50 · CACHED"
            tag={
              summary?.lcpColdP50 != null || summary?.lcpCachedP50 != null
                ? 'BY CACHE'
                : ''
            }
          />
          <BigStat
            value={summary?.lcpCachedP50 != null ? (summary.lcpCachedP50 / 1000).toFixed(2) : '—'}
            unit={summary?.lcpCachedP50 != null ? 's' : undefined}
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
            {summary?.lcpCachedP50 != null ? (
              <div
                style={{
                  position: 'absolute',
                  top: -4,
                  left: `${Math.min(100, (summary.lcpCachedP50 / 6000) * 100)}%`,
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
              gap: 14,
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,.07)',
            }}
          >
            {summary?.lcpColdP50 != null || summary?.lcpCachedP50 != null ? (
              (() => {
                const sFmt = (v: number | null) => (v != null ? `${(v / 1000).toFixed(2)}s` : '—');
                const cold = summary?.lcpColdP50 ?? 0;
                const cached = summary?.lcpCachedP50 ?? 0;
                const scale = Math.max(cold, cached, 1);
                return (
                  <>
                    <PercentileCacheBlock
                      label="COLD"
                      p50={summary?.lcpColdP50 ?? null}
                      p75={summary?.lcpColdP75 ?? null}
                      p99={summary?.lcpColdP99 ?? null}
                      pct={(cold / scale) * 100}
                      tone="var(--warn)"
                      fmt={sFmt}
                    />
                    <PercentileCacheBlock
                      label="CACHED"
                      p50={summary?.lcpCachedP50 ?? null}
                      p75={summary?.lcpCachedP75 ?? null}
                      p99={summary?.lcpCachedP99 ?? null}
                      pct={(cached / scale) * 100}
                      tone="var(--good)"
                      fmt={sFmt}
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
              hit p50
            </span>
          }
        >
          <VisualHead
            label="TTFB P50 · HIT"
            tag={
              summary?.ttfbHitP50 != null || summary?.ttfbMissP50 != null
                ? 'BY CACHE'
                : ''
            }
          />
          <BigStat
            value={summary?.ttfbHitP50 != null ? String(Math.round(summary.ttfbHitP50)) : '—'}
            unit={summary?.ttfbHitP50 != null ? 'ms' : undefined}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            {summary?.ttfbHitP50 != null || summary?.ttfbMissP50 != null ? (
              (() => {
                const hitP50 = summary?.ttfbHitP50 ?? 0;
                const missP50 = summary?.ttfbMissP50 ?? 0;
                const scale = Math.max(hitP50, missP50, 1);
                return (
                  <>
                    <PercentileCacheBlock
                      label="HIT"
                      count={summary?.ttfbHitCount ?? 0}
                      p50={summary?.ttfbHitP50 ?? null}
                      p75={summary?.ttfbHitP75 ?? null}
                      p99={summary?.ttfbHitP99 ?? null}
                      pct={(hitP50 / scale) * 100}
                      tone="var(--good)"
                    />
                    <PercentileCacheBlock
                      label="MISS"
                      count={summary?.ttfbMissCount ?? 0}
                      p50={summary?.ttfbMissP50 ?? null}
                      p75={summary?.ttfbMissP75 ?? null}
                      p99={summary?.ttfbMissP99 ?? null}
                      pct={(missP50 / scale) * 100}
                      tone="var(--warn)"
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
          title="Active dwell time"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              AFK filtered
            </span>
          }
        >
          <div style={{ display: 'flex', gap: 26, marginTop: 18 }}>
            <div>
              <div className="mono" style={{ fontSize: 20, color: 'var(--text)' }}>
                {formatDuration(summary?.sessionActiveP50 ?? null)}
              </div>
              <div className="mono faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                median active
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 20, color: 'rgba(237,237,240,.45)' }}>
                {formatDuration(summary?.sessionWallP50 ?? null)}
              </div>
              <div className="mono faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                wall clock
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,255,255,.06)',
              }}
            >
              <div
                style={{
                  width: `${attentionPct}%`,
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--accent)',
                }}
              />
            </div>
            <div
              className="mono"
              style={{
                marginTop: 8,
                fontSize: 11,
                color: 'rgba(237,237,240,.35)',
              }}
            >
              {attentionPct !== null
                ? `${attentionPct.toFixed(0)}% of open time counted as attention`
                : 'not enough wall-clock samples yet'}
            </div>
          </div>
        </Card>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}
      >
        <Card
          title="Session start / end + duration"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              7d
            </span>
          }
        >
          <div style={{ marginTop: 10, display: 'flex', gap: 26 }}>
            <div>
              <div className="mono" style={{ fontSize: 26, color: 'var(--text)' }}>
                {summary ? summary.sessions.toLocaleString() : '—'}
              </div>
              <div className="mono faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                sessions
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 26, color: 'var(--text)' }}>
                {formatDuration(summary?.sessionWallP50 ?? null)}
              </div>
              <div className="mono faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                median duration
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 26, color: 'var(--text)' }}>
                {pagesPerSession !== null ? pagesPerSession.toFixed(1) : '—'}
              </div>
              <div className="mono faint" style={{ fontSize: 10.5, marginTop: 3 }}>
                pages / session
              </div>
            </div>
          </div>
          <div
            className="mono faint"
            style={{ fontSize: 10.5, marginTop: 20 }}
          >
            distribution by wall-clock duration
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 6,
              height: 60,
              marginTop: 8,
            }}
          >
            {(summary?.sessionWallDurationBuckets ?? []).map((b) => {
              const maxCount = Math.max(
                1,
                ...(summary?.sessionWallDurationBuckets.map((s) => s.count) ?? [1]),
              );
              return (
                <div
                  key={b.key}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={`${b.count.toLocaleString()} sessions`}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(4, (b.count / maxCount) * 44)}px`,
                      borderRadius: 3,
                      background: 'rgba(123,92,224,.5)',
                    }}
                  />
                  <span className="mono faint" style={{ fontSize: 9.5 }}>
                    {b.key}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="Navigation timing"
          aside={
            <span className="mono faint" style={{ fontSize: 11 }}>
              cold nav · load phases · avg over all time
            </span>
          }
        >
          {navPhases ? (
            <>
              <div
                style={{
                  display: 'flex',
                  height: 10,
                  borderRadius: 5,
                  overflow: 'hidden',
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    width: `${navPhases.dnsPct}%`,
                    background: 'var(--accent)',
                  }}
                />
                <div
                  style={{
                    width: `${navPhases.tcpPct}%`,
                    background: 'rgba(123,92,224,.72)',
                  }}
                />
                <div
                  style={{
                    width: `${navPhases.domPct}%`,
                    background: 'rgba(123,92,224,.48)',
                  }}
                />
                <div
                  style={{
                    width: `${navPhases.completePct}%`,
                    background: 'rgba(123,92,224,.26)',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px 18px',
                  marginTop: 14,
                }}
              >
                {[
                  ['DNS', `${Math.round(navPhases.dns)}ms`],
                  ['TCP + TLS', `${Math.round(navPhases.tcp)}ms`],
                  ['DOM load', `${Math.round(navPhases.dom)}ms`],
                  ['complete', formatSeconds(navPhases.complete)],
                ].map(([l, v]) => (
                  <div
                    key={l}
                    className="mono"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      color: 'rgba(237,237,240,.62)',
                    }}
                  >
                    <span>{l}</span>
                    <span style={{ color: 'var(--text)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              className="mono faint"
              style={{ fontSize: 11, marginTop: 16 }}
            >
              No cold-navigation samples with load-phase data yet.
            </div>
          )}
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

      <div className="panel" style={{ overflow: 'hidden' }}>
        <div
          className="thead"
          style={{
            display: 'grid',
            gridTemplateColumns: '2.2fr 1.4fr 90px 70px 170px',
          }}
        >
          <span>MESSAGE</span>
          <span>FILE</span>
          <span>LINE:COL</span>
          <span>COUNT</span>
          <span>LAST SEEN</span>
        </div>
        {errorsFailed ? (
          <div className="mono faint" style={{ padding: '15px 30px', fontSize: 11 }}>
            failed to load errors
          </div>
        ) : null}
        {!errorsFailed && errors && errors.length === 0 ? (
          <div className="mono faint" style={{ padding: '15px 30px', fontSize: 11 }}>
            No errors recorded.
          </div>
        ) : null}
        {(errors ?? []).map((err) => {
          const expanded = expandedFingerprint === err.fingerprint;
          const snapshots = snapshotsByFingerprint[err.fingerprint];
          return (
            <div key={err.fingerprint}>
              <div
                className="tr row-hover"
                style={{
                  gridTemplateColumns: '2.2fr 1.4fr 90px 70px 170px',
                  cursor: 'pointer',
                }}
                onClick={() => toggleErrorRow(err.fingerprint)}
              >
                <span
                  style={{
                    font: '400 13px var(--sans)',
                    color: 'rgba(237,237,240,.8)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={err.message}
                >
                  {err.message}
                </span>
                <span
                  className="mono faint"
                  style={{
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={err.file ?? undefined}
                >
                  {err.file ?? '—'}
                </span>
                <span className="mono faint" style={{ fontSize: 11 }}>
                  {err.line ?? '—'}:{err.col ?? '—'}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {err.count.toLocaleString()}
                </span>
                <span className="mono faint" style={{ fontSize: 11 }}>
                  {new Date(err.lastSeenAt).toLocaleString()}
                </span>
              </div>
              {expanded ? (
                <div
                  style={{
                    padding: '12px 30px',
                    borderBottom: '1px solid rgba(255,255,255,.07)',
                    background: 'rgba(255,255,255,.02)',
                  }}
                >
                  {snapshots === 'loading' ? (
                    <div className="mono faint" style={{ fontSize: 11 }}>
                      loading raw snapshots…
                    </div>
                  ) : null}
                  {snapshots === 'failed' ? (
                    <div className="mono faint" style={{ fontSize: 11 }}>
                      failed to load raw snapshots
                    </div>
                  ) : null}
                  {Array.isArray(snapshots) && snapshots.length === 0 ? (
                    <div className="mono faint" style={{ fontSize: 11 }}>
                      No raw snapshots retained for this fingerprint (current
                      + previous month only).
                    </div>
                  ) : null}
                  {Array.isArray(snapshots)
                    ? snapshots.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            marginBottom: 10,
                            paddingBottom: 10,
                            borderBottom: '1px solid rgba(255,255,255,.05)',
                          }}
                        >
                          <div
                            className="mono faint"
                            style={{ fontSize: 10.5, marginBottom: 4 }}
                          >
                            {new Date(s.receivedAt).toLocaleString()}
                          </div>
                          <pre
                            className="mono"
                            style={{
                              fontSize: 11,
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              color: 'rgba(237,237,240,.7)',
                            }}
                          >
                            {JSON.stringify(
                              { device: s.device, events: s.events },
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      ))
                    : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
