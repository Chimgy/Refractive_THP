import type { CSSProperties } from 'react';
import type { Cohort } from './fakeRetentionCohorts';

export default function RetentionTriangle({
  cohorts,
  compact = false,
}: {
  cohorts: Cohort[];
  compact?: boolean;
}) {
  const maxOffset = Math.max(0, ...cohorts.map((c) => c.weeksElapsed));
  const cellMinWidth = compact ? 38 : 56;
  const spacing = compact ? 4 : 6;

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <table
        className="mono"
        style={{
          borderCollapse: 'separate',
          borderSpacing: spacing,
          fontSize: compact ? 11 : 13,
          width: '100%',
        }}
      >
        <thead>
          <tr>
            <th style={headStyle('left', compact)}>Cohort</th>
            <th style={headStyle('right', compact)}>Size</th>
            {Array.from({ length: maxOffset + 1 }, (_, i) => (
              <th key={i} style={{ ...headStyle('center', compact), minWidth: cellMinWidth }}>
                W{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.label}>
              <td style={{ padding: compact ? '5px 8px' : '7px 10px', color: 'var(--muted)' }}>
                {c.label}
              </td>
              <td
                style={{
                  padding: compact ? '5px 8px' : '7px 10px',
                  textAlign: 'right',
                  color: 'var(--muted)',
                }}
              >
                {c.size}
              </td>
              {c.retentionPct.slice(0, maxOffset + 1).map((pct, i) => (
                <td
                  key={i}
                  style={{
                    padding: compact ? '6px 4px' : '9px 6px',
                    minWidth: cellMinWidth,
                    textAlign: 'center',
                    borderRadius: 6,
                    background:
                      pct == null ? 'rgba(255,255,255,.03)' : `rgba(123,92,224,${Math.max(0.1, (pct / 100) * 0.85)})`,
                    color: pct == null ? 'transparent' : 'var(--text)',
                  }}
                >
                  {pct == null ? '' : `${pct}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function headStyle(align: 'left' | 'right' | 'center', compact: boolean): CSSProperties {
  return {
    textAlign: align,
    padding: compact ? '4px 8px' : '5px 10px',
    color: 'var(--faint)',
    fontWeight: 500,
    fontSize: compact ? 10.5 : 11.5,
  };
}
