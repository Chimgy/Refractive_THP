import { useCallback, useMemo, useState } from 'react';
import WidgetShell from '../WidgetShell';
import type { DragHandleProps } from '../grid/DashboardGrid';
import type { WidgetInstance } from '../grid/types';
import RangeSelect from '../common/RangeSelect';
import ExpandedViewModal from '../common/ExpandedViewModal';
import FunnelStepEditor from './FunnelStepEditor';
import {
  UTM_SEGMENT_OPTIONS,
  type FunnelStep,
  type MarketingFunnelConfig,
} from './config';
import { funnelResultsToCsv, generateFunnelResults } from './fakeFunnelData';

type Props = {
  instance: WidgetInstance<MarketingFunnelConfig>;
  onUpdate: (next: WidgetInstance<MarketingFunnelConfig>) => void;
  onDuplicate: (instance: WidgetInstance<MarketingFunnelConfig>) => void;
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

export default function MarketingFunnelWidget({
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

  const results = useMemo(
    () => generateFunnelResults(config, config.steps),
    [config],
  );
  const first = results[0]?.count ?? 0;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    onUpdate({
      ...instance,
      config: { ...config, seed: Date.now() & 0xffffffff },
    });
    window.setTimeout(() => setRefreshing(false), 300);
  }, [instance, config, onUpdate]);

  const handleSegmentChange = useCallback(
    (utmSegment: string) =>
      onUpdate({ ...instance, config: { ...config, utmSegment } }),
    [instance, config, onUpdate],
  );

  const handleRename = useCallback(
    (title: string) => onUpdate({ ...instance, title }),
    [instance, onUpdate],
  );

  const handleExport = useCallback(() => {
    downloadCsv(
      `${instance.title.replace(/\s+/g, '-').toLowerCase()}.csv`,
      funnelResultsToCsv(results),
    );
  }, [instance.title, results]);

  const handleDuplicate = useCallback(
    () => onDuplicate(instance),
    [onDuplicate, instance],
  );

  const handleSaveSteps = useCallback(
    (steps: FunnelStep[]) => {
      onUpdate({ ...instance, config: { ...config, steps } });
      setEditorOpen(false);
    },
    [instance, config, onUpdate],
  );

  const funnelList = (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {results.map((r, i) => (
        <FunnelBarRow
          key={r.step.id}
          label={r.label}
          count={r.count}
          pctOfFirst={first > 0 ? (r.count / first) * 100 : 0}
          dropOffPct={
            i > 0 && results[i - 1].count > 0
              ? ((results[i - 1].count - r.count) / results[i - 1].count) * 100
              : null
          }
        />
      ))}
    </div>
  );

  return (
    <WidgetShell
      title={instance.title}
      description={
        instance.description ?? `${config.steps.length} steps · grouped by UTM`
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
          value={config.utmSegment}
          options={UTM_SEGMENT_OPTIONS}
          onChange={handleSegmentChange}
        />
      }
    >
      {funnelList}

      {expanded && (
        <ExpandedViewModal
          title={`${instance.title} — detail`}
          onClose={() => setExpanded(false)}
        >
          {funnelList}
        </ExpandedViewModal>
      )}

      {editorOpen && (
        <FunnelStepEditor
          steps={config.steps}
          onCancel={() => setEditorOpen(false)}
          onSave={handleSaveSteps}
        />
      )}
    </WidgetShell>
  );
}

function FunnelBarRow({
  label,
  count,
  pctOfFirst,
  dropOffPct,
}: {
  label: string;
  count: number;
  pctOfFirst: number;
  dropOffPct: number | null;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 5,
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 13, color: 'rgba(237,237,240,.75)' }}
        >
          {label}
        </span>
        <span className="mono" style={{ fontSize: 12.5, color: 'var(--text)' }}>
          {count.toLocaleString()}
        </span>
      </div>
      <div
        style={{
          height: 18,
          borderRadius: 4,
          background: 'rgba(255,255,255,.06)',
        }}
      >
        <div
          style={{
            width: `${Math.max(1, Math.min(100, pctOfFirst))}%`,
            height: 18,
            borderRadius: 4,
            background: 'var(--accent)',
          }}
        />
      </div>
      <div className="mono faint" style={{ fontSize: 11, marginTop: 4 }}>
        {pctOfFirst.toFixed(0)}% of top
        {dropOffPct != null ? ` · -${dropOffPct.toFixed(0)}% drop-off` : ''}
      </div>
    </div>
  );
}
