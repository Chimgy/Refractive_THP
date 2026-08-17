import { useCallback, useMemo, useState } from 'react';
import {
  CartesianGrid,
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
import RangeSelect from '../common/RangeSelect';
import ExpandedViewModal from '../common/ExpandedViewModal';
import ActiveUserRuleEditor from './ActiveUserRuleEditor';
import { describeRuleSet, type ActiveUserRuleSet } from './activeUserRules';
import { RANGE_OPTIONS, type DauWauMauConfig, type SeriesKey } from './config';
import { generateActiveUsersSeries, seriesToCsv } from './fakeActiveUsers';

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

const HOVER_CURSOR = { stroke: 'rgba(237,237,240,.18)' };

const SERIES_META: Record<SeriesKey, { label: string; tone: string; dashArray?: string }> = {
  dau: { label: 'DAU', tone: '#7b5ce0' },
  wau: { label: 'WAU', tone: '#35c08a' },
  mau: { label: 'MAU', tone: '#e0a33b', dashArray: '4 3' },
};

type Props = {
  instance: WidgetInstance<DauWauMauConfig>;
  onUpdate: (next: WidgetInstance<DauWauMauConfig>) => void;
  onDuplicate: (instance: WidgetInstance<DauWauMauConfig>) => void;
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

export default function DauWauMauWidget({
  instance,
  onUpdate,
  onDuplicate,
  onRemove,
  dragHandleProps,
}: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const series = useMemo(
    () => generateActiveUsersSeries(instance.config.days, instance.config.seed),
    [instance.config.days, instance.config.seed],
  );

  const latest = series[series.length - 1];

  const tickInterval = useMemo(
    () => Math.max(0, Math.ceil(series.length / 9) - 1),
    [series.length],
  );

  const definitionSummary = useMemo(
    () => describeRuleSet(instance.config.ruleSet),
    [instance.config.ruleSet],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    onUpdate({
      ...instance,
      config: { ...instance.config, seed: Date.now() & 0xffffffff },
    });
    window.setTimeout(() => setRefreshing(false), 300);
  }, [instance, onUpdate]);

  const handleRangeChange = useCallback(
    (days: number) => {
      onUpdate({ ...instance, config: { ...instance.config, days } });
    },
    [instance, onUpdate],
  );

  const handleRename = useCallback(
    (title: string) => onUpdate({ ...instance, title }),
    [instance, onUpdate],
  );

  const handleExport = useCallback(() => {
    downloadCsv(`${instance.title.replace(/\s+/g, '-').toLowerCase()}.csv`, seriesToCsv(series));
  }, [instance.title, series]);

  const handleDuplicate = useCallback(() => onDuplicate(instance), [onDuplicate, instance]);

  const handleSaveEdit = useCallback(
    ({ ruleSet, visibleSeries }: { ruleSet: ActiveUserRuleSet; visibleSeries: SeriesKey[] }) => {
      onUpdate({ ...instance, config: { ...instance.config, ruleSet, visibleSeries } });
      setEditorOpen(false);
    },
    [instance, onUpdate],
  );

  const readoutRow = (
    <div style={{ display: 'flex', gap: 22, marginBottom: 14, flex: 'none' }}>
      {instance.config.visibleSeries.map((key) => (
        <SeriesReadout
          key={key}
          label={SERIES_META[key].label}
          tone={SERIES_META[key].tone}
          value={latest?.[key]}
        />
      ))}
    </div>
  );

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
        <XAxis
          dataKey="label"
          interval={tickInterval}
          angle={-30}
          textAnchor="end"
          height={42}
          dy={8}
          {...axis}
        />
        <YAxis {...axis} width={46} />
        <Tooltip contentStyle={tooltipStyle} cursor={HOVER_CURSOR} />
        {instance.config.visibleSeries.map((key) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={SERIES_META[key].label}
            stroke={SERIES_META[key].tone}
            strokeWidth={key === 'dau' ? 2 : 1.75}
            strokeDasharray={SERIES_META[key].dashArray}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <WidgetShell
      title={instance.title}
      description={instance.description ?? definitionSummary}
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
        <RangeSelect
          value={instance.config.days}
          options={RANGE_OPTIONS}
          onChange={handleRangeChange}
        />
      }
    >
      {readoutRow}
      <div style={{ flex: 1, minHeight: 140 }}>{chart}</div>

      {editorOpen && (
        <ActiveUserRuleEditor
          ruleSet={instance.config.ruleSet}
          visibleSeries={instance.config.visibleSeries}
          onCancel={() => setEditorOpen(false)}
          onSave={handleSaveEdit}
        />
      )}

      {expanded && (
        <ExpandedViewModal title={`${instance.title} — detail`} onClose={() => setExpanded(false)}>
          {readoutRow}
          <div style={{ height: 520 }}>{chart}</div>
        </ExpandedViewModal>
      )}
    </WidgetShell>
  );
}

function SeriesReadout({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: number | undefined;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 2,
          background: tone,
          flex: 'none',
        }}
      />
      <div>
        <div className="mono" style={{ fontSize: 19, color: 'var(--text)' }}>
          {value?.toLocaleString() ?? '—'}
        </div>
        <div className="mono faint" style={{ fontSize: 11, marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}
