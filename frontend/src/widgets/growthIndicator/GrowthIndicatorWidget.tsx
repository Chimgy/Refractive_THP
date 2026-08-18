import { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import GrowthIndicatorEditor from './GrowthIndicatorEditor';
import {
  INTERVAL_OPTIONS,
  type GrowthIndicatorConfig,
  type GrowthSegment,
} from './config';
import {
  generateGrowthSegments,
  growthSegmentsToCsv,
} from './fakeGrowthSegments';

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

// A light, low-opacity grey rect on hover instead of recharts' bright
// default cursor fill, which read as too harsh against the stacked bars.
const HOVER_CURSOR = { fill: 'rgba(237,237,240,.07)' };

const SEGMENT_META: Record<GrowthSegment, { label: string; tone: string }> = {
  new: { label: 'New', tone: '#7b5ce0' },
  returning: { label: 'Returning', tone: '#35c08a' },
  dormant: { label: 'Dormant', tone: 'rgba(237,237,240,.42)' },
  resurrecting: { label: 'Resurrecting', tone: '#e0a33b' },
};

type Props = {
  instance: WidgetInstance<GrowthIndicatorConfig>;
  onUpdate: (next: WidgetInstance<GrowthIndicatorConfig>) => void;
  onDuplicate: (instance: WidgetInstance<GrowthIndicatorConfig>) => void;
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

export default function GrowthIndicatorWidget({
  instance,
  onUpdate,
  onDuplicate,
  onRemove,
  dragHandleProps,
}: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const points = useMemo(
    () => generateGrowthSegments(instance.config),
    [instance.config],
  );
  const latest = points[points.length - 1];

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    onUpdate({
      ...instance,
      config: { ...instance.config, seed: Date.now() & 0xffffffff },
    });
    window.setTimeout(() => setRefreshing(false), 300);
  }, [instance, onUpdate]);

  const handleIntervalChange = useCallback(
    (interval: GrowthIndicatorConfig['interval']) =>
      onUpdate({ ...instance, config: { ...instance.config, interval } }),
    [instance, onUpdate],
  );

  const handleRename = useCallback(
    (title: string) => onUpdate({ ...instance, title }),
    [instance, onUpdate],
  );

  const handleExport = useCallback(() => {
    downloadCsv(
      `${instance.title.replace(/\s+/g, '-').toLowerCase()}.csv`,
      growthSegmentsToCsv(points),
    );
  }, [instance.title, points]);

  const handleDuplicate = useCallback(
    () => onDuplicate(instance),
    [onDuplicate, instance],
  );

  const handleSaveEdit = useCallback(
    (next: Partial<GrowthIndicatorConfig>) => {
      onUpdate({ ...instance, config: { ...instance.config, ...next } });
      setEditorOpen(false);
    },
    [instance, onUpdate],
  );

  const readoutRow = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 18,
        marginBottom: 14,
        flex: 'none',
      }}
    >
      {instance.config.visibleSegments.map((key) => (
        <SegmentReadout
          key={key}
          label={SEGMENT_META[key].label}
          tone={SEGMENT_META[key].tone}
          value={latest?.[key]}
        />
      ))}
    </div>
  );

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={points}
        margin={{ top: 4, right: 8, bottom: 4, left: -12 }}
      >
        <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={46} />
        <Tooltip contentStyle={tooltipStyle} cursor={HOVER_CURSOR} />
        {instance.config.visibleSegments.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            name={SEGMENT_META[key].label}
            stackId="segments"
            fill={SEGMENT_META[key].tone}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <WidgetShell
      title={instance.title}
      description={
        instance.description ??
        'Logged-in users only — IP-based identification isn’t used.'
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
        <RangeSelect
          value={instance.config.interval}
          options={INTERVAL_OPTIONS}
          onChange={handleIntervalChange}
        />
      }
    >
      {readoutRow}
      <div style={{ flex: 1, minHeight: 140 }}>{chart}</div>

      {editorOpen && (
        <GrowthIndicatorEditor
          value={instance.config}
          onCancel={() => setEditorOpen(false)}
          onSave={handleSaveEdit}
        />
      )}

      {expanded && (
        <ExpandedViewModal
          title={`${instance.title} — detail`}
          onClose={() => setExpanded(false)}
        >
          {readoutRow}
          <div style={{ height: 520 }}>{chart}</div>
        </ExpandedViewModal>
      )}
    </WidgetShell>
  );
}

function SegmentReadout({
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
