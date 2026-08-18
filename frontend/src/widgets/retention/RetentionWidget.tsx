import { useCallback, useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import WidgetShell from '../WidgetShell';
import type { DragHandleProps } from '../grid/DashboardGrid';
import type { WidgetInstance } from '../grid/types';
import ExpandedViewModal from '../common/ExpandedViewModal';
import { seedFromString } from '../mockSeeded';
import RetentionEditor from './RetentionEditor';
import RetentionTriangle from './RetentionTriangle';
import {
  COHORT_TYPE_OPTIONS,
  type RetentionConfig,
  type ViewMode,
} from './config';
import {
  averageRetentionCurve,
  cohortsToCsv,
  generateRetentionCohorts,
} from './fakeRetentionCohorts';

const axis = {
  stroke: 'rgba(237,237,240,.3)',
  fontSize: 11.5,
  fontFamily: 'var(--mono)',
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  background: '#0f0f14',
  border: '1px solid rgba(255,255,255,.13)',
  borderRadius: 7,
  font: '12.5px var(--mono)',
  color: '#ededf0',
};

// A light, low-opacity grey line-cursor on hover instead of recharts'
// default, matching the same fix applied to Growth Indicator's bar chart.
const HOVER_CURSOR = { stroke: 'rgba(237,237,240,.18)' };

type Props = {
  instance: WidgetInstance<RetentionConfig>;
  onUpdate: (next: WidgetInstance<RetentionConfig>) => void;
  onDuplicate: (instance: WidgetInstance<RetentionConfig>) => void;
  onRemove: (id: string) => void;
  dragHandleProps: DragHandleProps;
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RetentionWidget({
  instance,
  onUpdate,
  onDuplicate,
  onRemove,
  dragHandleProps,
}: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { config } = instance;

  // The entity selection and basis have no real segmented data behind them
  // yet — folding them into the seed at least makes changing them visibly
  // change the fake dataset, rather than being inert controls.
  const effectiveSeed = useMemo(
    () =>
      seedFromString(
        `${config.seed}:${config.cohortType}:${config.selectedEntities.join(',')}:${JSON.stringify(config.retentionBasis)}`,
      ),
    [
      config.seed,
      config.cohortType,
      config.selectedEntities,
      config.retentionBasis,
    ],
  );

  const cohorts = useMemo(
    () =>
      generateRetentionCohorts({
        seed: effectiveSeed,
        cohortWeeks: config.cohortWeeks,
        cohortType: config.cohortType,
        selectedEntities: config.selectedEntities,
        retentionBasis: config.retentionBasis,
      }),
    [
      effectiveSeed,
      config.cohortWeeks,
      config.cohortType,
      config.selectedEntities,
      config.retentionBasis,
    ],
  );

  const avgCurve = useMemo(() => averageRetentionCurve(cohorts), [cohorts]);
  const recentCohorts = useMemo(() => cohorts.slice(-4), [cohorts]);

  const chartData = useMemo(() => {
    const maxOffset = Math.max(0, ...cohorts.map((c) => c.weeksElapsed));
    return Array.from({ length: maxOffset + 1 }, (_, offset) => {
      const row: Record<string, number | undefined> & { offset: number } = {
        offset,
      };
      row.average = avgCurve.find((p) => p.offset === offset)?.pct;
      recentCohorts.forEach((c, i) => {
        row[`c${i}`] = c.retentionPct[offset] ?? undefined;
      });
      return row;
    });
  }, [cohorts, avgCurve, recentCohorts]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    onUpdate({
      ...instance,
      config: { ...config, seed: Date.now() & 0xffffffff },
    });
    window.setTimeout(() => setRefreshing(false), 300);
  }, [instance, config, onUpdate]);

  const setViewMode = useCallback(
    (viewMode: ViewMode) =>
      onUpdate({ ...instance, config: { ...config, viewMode } }),
    [instance, config, onUpdate],
  );

  const handleRename = useCallback(
    (title: string) => onUpdate({ ...instance, title }),
    [instance, onUpdate],
  );

  const handleExport = useCallback(() => {
    downloadCsv(
      `${instance.title.replace(/\s+/g, '-').toLowerCase()}.csv`,
      cohortsToCsv(cohorts),
    );
  }, [instance.title, cohorts]);

  const handleDuplicate = useCallback(
    () => onDuplicate(instance),
    [onDuplicate, instance],
  );

  const handleSaveEdit = useCallback(
    (next: Partial<RetentionConfig>) => {
      onUpdate({ ...instance, config: { ...config, ...next } });
      setEditorOpen(false);
    },
    [instance, config, onUpdate],
  );

  const graphView = (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 4, right: 8, bottom: 4, left: -12 }}
      >
        <XAxis dataKey="offset" tickFormatter={(v) => `W${v}`} {...axis} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          {...axis}
          width={40}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={HOVER_CURSOR}
          labelFormatter={(v) => `Week ${v}`}
        />
        {recentCohorts.map((c, i) => (
          <Line
            key={c.label}
            type="monotone"
            dataKey={`c${i}`}
            name={c.label}
            stroke="rgba(237,237,240,.28)"
            strokeWidth={1}
            dot={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="average"
          name="Average"
          stroke="#7b5ce0"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <WidgetShell
      title={instance.title}
      description={
        instance.description ??
        `${COHORT_TYPE_OPTIONS.find((o) => o.value === config.cohortType)?.label} · ${config.cohortWeeks}w`
      }
      dragHandleProps={dragHandleProps}
      loading={refreshing}
      onRefresh={handleRefresh}
      onEdit={() => setEditorOpen(true)}
      onExport={handleExport}
      onRename={handleRename}
      onDuplicate={handleDuplicate}
      onExpand={() => setExpanded(true)}
      onRemove={() => onRemove(instance.id)}
      headerExtra={
        <div className="range">
          <button
            type="button"
            className={config.viewMode === 'graph' ? 'on' : ''}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setViewMode('graph')}
          >
            Graph
          </button>
          <button
            type="button"
            className={config.viewMode === 'table' ? 'on' : ''}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
        </div>
      }
    >
      <div style={{ flex: 1, minHeight: 120 }}>
        {config.viewMode === 'graph' ? (
          graphView
        ) : (
          <RetentionTriangle cohorts={cohorts} compact />
        )}
      </div>

      {editorOpen && (
        <RetentionEditor
          value={config}
          onCancel={() => setEditorOpen(false)}
          onSave={handleSaveEdit}
        />
      )}

      {expanded && (
        <ExpandedViewModal
          title={`${instance.title} — detail`}
          onClose={() => setExpanded(false)}
        >
          <div className="label">Graph</div>
          <div style={{ height: 340, marginTop: 10 }}>{graphView}</div>
          <div className="label" style={{ marginTop: 26 }}>
            Table
          </div>
          <div style={{ marginTop: 10 }}>
            <RetentionTriangle cohorts={cohorts} />
          </div>
        </ExpandedViewModal>
      )}
    </WidgetShell>
  );
}
