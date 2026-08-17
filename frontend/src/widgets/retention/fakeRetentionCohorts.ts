import { mulberry32 } from '../mockSeeded';
import type { CohortType, RetentionBasis } from './config';
import { entityNamesFor } from './config';

export type Cohort = {
  label: string;
  size: number;
  weeksElapsed: number;
  retentionPct: (number | null)[];
};

function toMinutes(value: number, unit: 'ms' | 's' | 'min'): number {
  if (unit === 'ms') return value / 60000;
  if (unit === 's') return value / 60;
  return value;
}

// A narrower "retained" definition should read as a harder bar to clear —
// logged-in is the loosest, a specific page visit the strictest.
function retentionBoostFor(basis: RetentionBasis): number {
  switch (basis.kind) {
    case 'logged_in':
      return 0.06;
    case 'stayed_on_site': {
      const minutes = toMinutes(basis.value, basis.unit);
      return Math.max(-0.05, 0.05 - minutes * 0.01);
    }
    case 'feature_engagement':
      return -0.03;
    case 'visited_page':
      return -0.05;
  }
}

// weeksElapsed caps how many offsets have real data — a row that "started"
// only 2 weeks ago can't have a week-5 number yet, which is what gives the
// triangle its shape. For weekly_signup rows that's literally the calendar
// week; for release/feature/campaign rows it's weeks since a fabricated
// launch date spread across the lookback window.
export function generateRetentionCohorts(params: {
  seed: number;
  cohortWeeks: number;
  cohortType: CohortType;
  selectedEntities: string[];
  retentionBasis: RetentionBasis;
}): Cohort[] {
  const { seed, cohortWeeks, cohortType, selectedEntities, retentionBasis } = params;
  const rand = mulberry32(seed);
  const boost = retentionBoostFor(retentionBasis);
  const today = new Date();

  let rows: { label: string; weeksAgo: number }[];
  if (cohortType === 'weekly_signup') {
    rows = Array.from({ length: cohortWeeks }, (_, c) => {
      const weeksAgo = cohortWeeks - 1 - c;
      const date = new Date(today);
      date.setDate(date.getDate() - weeksAgo * 7);
      return {
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        weeksAgo,
      };
    });
  } else {
    const all = entityNamesFor(cohortType);
    const names = all.filter((n) => selectedEntities.length === 0 || selectedEntities.includes(n));
    rows = names.map((label, i) => ({
      label,
      weeksAgo: Math.max(0, Math.round(((names.length - i) / names.length) * (cohortWeeks - 1))),
    }));
  }

  return rows.map(({ label, weeksAgo }) => {
    const size = Math.round(60 + rand() * 140);
    const weeksElapsed = Math.min(weeksAgo, cohortWeeks - 1);
    const decay = Math.min(0.94, Math.max(0.4, 0.72 + rand() * 0.15 + boost));

    const pcts: (number | null)[] = [];
    let pct = 100;
    for (let offset = 0; offset < cohortWeeks; offset++) {
      if (offset > weeksElapsed) {
        pcts.push(null);
        continue;
      }
      if (offset === 0) {
        pcts.push(100);
        continue;
      }
      pct = Math.max(2, pct * decay * (0.9 + rand() * 0.2));
      pcts.push(Math.round(pct));
    }
    return { label, size, weeksElapsed, retentionPct: pcts };
  });
}

// Average across whichever rows have data for a given offset, so the
// aggregate curve isn't dragged down by rows that simply haven't lived long
// enough to reach that offset yet.
export function averageRetentionCurve(cohorts: Cohort[]): { offset: number; pct: number }[] {
  const maxOffset = Math.max(0, ...cohorts.map((c) => c.weeksElapsed));
  const points: { offset: number; pct: number }[] = [];
  for (let offset = 0; offset <= maxOffset; offset++) {
    const values = cohorts
      .map((c) => c.retentionPct[offset])
      .filter((v): v is number => v != null);
    if (values.length === 0) continue;
    points.push({ offset, pct: values.reduce((s, v) => s + v, 0) / values.length });
  }
  return points;
}

export function cohortsToCsv(cohorts: Cohort[]): string {
  const maxOffset = Math.max(0, ...cohorts.map((c) => c.weeksElapsed));
  const header = ['cohort', 'size', ...Array.from({ length: maxOffset + 1 }, (_, i) => `w${i}`)].join(',');
  const rows = cohorts.map((c) =>
    [c.label, c.size, ...c.retentionPct.slice(0, maxOffset + 1).map((p) => p ?? '')].join(','),
  );
  return [header, ...rows].join('\n');
}
