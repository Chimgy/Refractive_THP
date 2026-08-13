type Props = {
  points: number[];
  tone?: string;
  width?: number;
  height?: number;
};

export default function Sparkline({
  points,
  tone = 'var(--accent)',
  width = 80,
  height = 26,
}: Props) {
  if (points.length < 2) return <span className="mono faint">—</span>;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 90;
      const y = 22 - ((p - min) / span) * 18;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 90 26"
      preserveAspectRatio="none"
      style={{ width, height }}
    >
      <polyline
        points={path}
        fill="none"
        stroke={tone}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
