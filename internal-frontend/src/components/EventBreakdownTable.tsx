import type { CSSProperties } from 'react';
import type { KeyCount } from '../api/metrics';

export default function EventBreakdownTable({ rows }: { rows: KeyCount[] }) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        No events recorded yet today.
      </p>
    );
  }

  return (
    <table style={{ borderCollapse: 'collapse', minWidth: 260 }}>
      <thead>
        <tr>
          <th style={cellStyle('left')}>Event type</th>
          <th style={cellStyle('right')}>Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td style={cellStyle('left')}>{row.key}</td>
            <td style={cellStyle('right')}>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cellStyle(align: 'left' | 'right'): CSSProperties {
  return {
    textAlign: align,
    padding: '4px 12px 4px 0',
    borderBottom: '1px solid #333',
    fontSize: 13,
  };
}
