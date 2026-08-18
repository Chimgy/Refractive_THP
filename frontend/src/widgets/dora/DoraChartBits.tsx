// Tiny presentational pieces shared by a couple of the DORA widgets — small
// enough that a registry entry per file would be overkill, but reused by
// more than one widget so they don't belong copy-pasted into each.

export function Sparkline({ values, tone }: { values: number[]; tone: string }) {
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
      style={{ overflow: 'visible', width: '100%', maxWidth: 104, minWidth: 44 }}
    >
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
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

export function LegendSwatch({
  label,
  tone,
  shape = 'square',
}: {
  label: string;
  tone: string;
  shape?: 'square' | 'line';
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {shape === 'square' ? (
        <span style={{ width: 9, height: 9, borderRadius: 2, background: tone }} />
      ) : (
        <span style={{ width: 13, height: 2, background: tone }} />
      )}
      {label}
    </span>
  );
}
