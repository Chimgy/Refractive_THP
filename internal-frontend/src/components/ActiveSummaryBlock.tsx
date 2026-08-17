import type { ActiveSummary } from '../api/metrics';
import MetricCard from './MetricCard';

export default function ActiveSummaryBlock({
  title,
  dailyLabel,
  summary,
}: {
  title: string;
  dailyLabel: string;
  summary: ActiveSummary;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>{title}</h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <MetricCard label={dailyLabel} value={summary.dau} />
        <MetricCard label="7-day" value={summary.wau} />
        <MetricCard label="30-day" value={summary.mau} />
      </div>
    </section>
  );
}
