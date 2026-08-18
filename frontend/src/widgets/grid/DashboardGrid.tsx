import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { GridLayout, WidgetInstance } from './types';
import WidgetErrorBoundary from '../common/WidgetErrorBoundary';

const GAP = 14;
const ROW_HEIGHT = 28;

type DragMode = 'move' | 'resize';

type DragState = {
  mode: DragMode;
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origLayout: GridLayout;
  cellWidth: number;
  columns: number;
  constraints: WidgetConstraints;
  preview: GridLayout;
};

export type WidgetConstraints = {
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
};

const DEFAULT_CONSTRAINTS: WidgetConstraints = {
  minW: 2,
  minH: 3,
  maxW: 12,
  maxH: 40,
};

export type DragHandleProps = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  style: { cursor: string; touchAction: string };
};

type Props<TInstance extends WidgetInstance<unknown>> = {
  widgets: TInstance[];
  onLayoutChange: (widgets: TInstance[]) => void;
  columns?: number;
  getConstraints?: (widget: TInstance) => WidgetConstraints;
  renderWidget: (
    widget: TInstance,
    dragHandleProps: DragHandleProps,
  ) => ReactNode;
};

function collides(a: GridLayout, b: GridLayout): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// CSS Grid does the actual pixel-perfect snapping — dragging/resizing just
// needs to resolve to integer (x, y, w, h) cell coordinates and write them
// back.
export default function DashboardGrid<
  TInstance extends WidgetInstance<unknown>,
>({
  widgets,
  onLayoutChange,
  columns = 12,
  getConstraints,
  renderWidget,
}: Props<TInstance>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewLayout, setPreviewLayout] = useState<GridLayout | null>(null);

  const rows = useMemo(
    () => Math.max(6, ...widgets.map((w) => w.layout.y + w.layout.h + 2)),
    [widgets],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.mode === 'move') {
        const dxCells = Math.round(
          (e.clientX - drag.startClientX) / drag.cellWidth,
        );
        const dyCells = Math.round(
          (e.clientY - drag.startClientY) / ROW_HEIGHT,
        );
        const nextX = Math.min(
          Math.max(0, drag.origLayout.x + dxCells),
          Math.max(0, drag.columns - drag.origLayout.w),
        );
        const nextY = Math.max(0, drag.origLayout.y + dyCells);
        const next = { ...drag.origLayout, x: nextX, y: nextY };
        drag.preview = next;
        setPreviewLayout(next);
        return;
      }

      // Resize: grow/shrink w/h from the origin corner, clamped to this
      // widget's min/max, the column count, and — if the candidate size would
      // overlap a neighbor — the last size that didn't. That gives the usual
      // "grows until it hits something" feel without needing real packing.
      const dwCells = Math.round(
        (e.clientX - drag.startClientX) / drag.cellWidth,
      );
      const dhCells = Math.round((e.clientY - drag.startClientY) / ROW_HEIGHT);
      const candidateW = Math.min(
        Math.max(drag.constraints.minW, drag.origLayout.w + dwCells),
        Math.min(drag.constraints.maxW, drag.columns - drag.origLayout.x),
      );
      const candidateH = Math.max(
        drag.constraints.minH,
        Math.min(drag.constraints.maxH, drag.origLayout.h + dhCells),
      );
      const candidate = { ...drag.origLayout, w: candidateW, h: candidateH };

      const others = widgets.filter((w) => w.id !== drag.id);
      const blocked = others.some((w) => collides(candidate, w.layout));
      if (!blocked) {
        drag.preview = candidate;
        setPreviewLayout(candidate);
      }
    },
    [widgets],
  );

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    dragRef.current = null;
    setDraggingId(null);
    setPreviewLayout(null);

    const moved = widgets.find((w) => w.id === drag.id);
    if (!moved) return;
    const target = drag.preview;

    if (drag.mode === 'resize') {
      onLayoutChange(
        widgets.map((w) => (w.id === drag.id ? { ...w, layout: target } : w)),
      );
      return;
    }

    // Simple swap-on-collision: if the drop cell overlaps exactly one other
    // widget, the two trade places. Anything more tangled just snaps back —
    // full packing is future work, not asked for here.
    const overlapping = widgets.filter(
      (w) => w.id !== drag.id && collides(target, w.layout),
    );

    let next: TInstance[];
    if (overlapping.length === 0) {
      next = widgets.map((w) =>
        w.id === drag.id ? { ...w, layout: target } : w,
      );
    } else if (overlapping.length === 1) {
      const other = overlapping[0];
      next = widgets.map((w) => {
        if (w.id === drag.id) return { ...w, layout: target };
        if (w.id === other.id) return { ...w, layout: drag.origLayout };
        return w;
      });
    } else {
      next = widgets;
    }
    onLayoutChange(next);
  }, [widgets, onLayoutChange, handlePointerMove]);

  const beginDrag = useCallback(
    (widget: TInstance, mode: DragMode) =>
      (e: ReactPointerEvent<HTMLElement>) => {
        e.stopPropagation();
        const container = containerRef.current;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const cellWidth = (containerWidth - GAP * (columns - 1)) / columns;
        const constraints = getConstraints?.(widget) ?? DEFAULT_CONSTRAINTS;

        dragRef.current = {
          mode,
          id: widget.id,
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          origLayout: widget.layout,
          cellWidth,
          columns,
          constraints,
          preview: widget.layout,
        };
        setDraggingId(widget.id);
        setPreviewLayout(widget.layout);
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp, { once: true });
      },
    [columns, getConstraints, handlePointerMove, handlePointerUp],
  );

  const layoutFor = useCallback(
    (widget: TInstance): GridLayout =>
      draggingId === widget.id && previewLayout ? previewLayout : widget.layout,
    [draggingId, previewLayout],
  );

  // Self-contained so WidgetErrorBoundary's fallback always has a working
  // "Remove widget" escape hatch, even though the caller owns the normal
  // (hamburger-menu) remove flow separately.
  const handleRemove = useCallback(
    (id: string) => onLayoutChange(widgets.filter((w) => w.id !== id)),
    [widgets, onLayoutChange],
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridAutoRows: `${ROW_HEIGHT}px`,
        gap: GAP,
        minHeight: rows * ROW_HEIGHT,
      }}
    >
      {widgets.map((widget) => {
        const layout = layoutFor(widget);
        const dragHandleProps: DragHandleProps = {
          onPointerDown: beginDrag(widget, 'move'),
          style: { cursor: 'grab', touchAction: 'none' },
        };
        const dragging = draggingId === widget.id;
        return (
          <div
            key={widget.id}
            className="grid-tile"
            style={{
              position: 'relative',
              gridColumn: `${layout.x + 1} / span ${layout.w}`,
              gridRow: `${layout.y + 1} / span ${layout.h}`,
              opacity: dragging ? 0.75 : 1,
              transition: dragging ? 'none' : 'opacity .15s',
              zIndex: dragging ? 10 : 1,
            }}
          >
            <WidgetErrorBoundary
              widgetTitle={widget.title}
              onRemove={() => handleRemove(widget.id)}
            >
              {renderWidget(widget, dragHandleProps)}
            </WidgetErrorBoundary>
            <div
              className="grid-resize-handle"
              onPointerDown={beginDrag(widget, 'resize')}
              title="Resize"
            />
          </div>
        );
      })}
    </div>
  );
}
