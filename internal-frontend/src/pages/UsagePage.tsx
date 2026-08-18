import { useEffect, useState } from 'react';
import { getUsageMetrics, type UsageSummary } from '../api/metrics';
import ActiveSummaryBlock from '../components/ActiveSummaryBlock';
import EventBreakdownTable from '../components/EventBreakdownTable';
import MetricCard from '../components/MetricCard';

// One block per item actually tracked today — no placeholders for
// feature adoption/workflow funnels/RUM vitals, since nothing populates
// those tables yet (plan §"Build order" Phases 2/3). Everything here reads
// straight from GET /api/metrics/usage.
export default function UsagePage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsageMetrics()
      .then(setSummary)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 18, marginBottom: 24 }}>Usage</h1>
      {error && <p style={{ color: '#e66' }}>Failed to load: {error}</p>}
      {!error && !summary && <p>Loading…</p>}

      {summary && (
        <>
          <ActiveSummaryBlock
            title="Active users"
            dailyLabel="DAU"
            summary={summary.users}
          />
          <ActiveSummaryBlock
            title="Active teams"
            dailyLabel="Today"
            summary={summary.teams}
          />

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
              Today's events
            </h2>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <MetricCard
                label="Total events"
                value={summary.today.totalEvents}
              />
              <MetricCard
                label="Actions / active user"
                value={summary.today.actionsPerUser ?? '—'}
              />
            </div>
            <EventBreakdownTable rows={summary.today.eventTypeCounts} />
          </section>
        </>
      )}
    </div>
  );
}
