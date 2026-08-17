import { mulberry32 } from '../mockSeeded';

export type ActiveUsersPoint = {
  date: string;
  label: string;
  dau: number;
  wau: number;
  mau: number;
};

// Fake but visually plausible: DAU is a mean-reverting random walk with
// weekly seasonality (weekend dip), WAU/MAU are derived from rolling
// averages over it (scaled up for the usual DAU-vs-unique-window overlap)
// rather than generated independently, so the three lines move together
// the way real ones would.
export function generateActiveUsersSeries(
  days: number,
  seed: number,
): ActiveUsersPoint[] {
  const rand = mulberry32(seed);
  const dau: number[] = [];
  let level = 900 + rand() * 500;

  for (let i = 0; i < days; i++) {
    const dayOfWeek = i % 7;
    const weekendDip = dayOfWeek === 5 || dayOfWeek === 6 ? 0.74 : 1;
    const drift = Math.sin(i / 9) * 70;
    const noise = (rand() - 0.5) * 110;
    level = level * 0.97 + (1000 + drift) * 0.03;
    dau.push(Math.max(60, Math.round((level + noise) * weekendDip)));
  }

  const today = new Date();
  const points: ActiveUsersPoint[] = [];
  for (let i = 0; i < days; i++) {
    const window7 = dau.slice(Math.max(0, i - 6), i + 1);
    const window30 = dau.slice(Math.max(0, i - 29), i + 1);
    const avg7 = window7.reduce((s, v) => s + v, 0) / window7.length;
    const avg30 = window30.reduce((s, v) => s + v, 0) / window30.length;
    const wau = Math.max(dau[i], Math.round(avg7 * 3.3 + (rand() - 0.5) * 120));
    const mau = Math.max(wau, Math.round(avg30 * 9.2 + (rand() - 0.5) * 300));

    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    points.push({
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      dau: dau[i],
      wau,
      mau,
    });
  }
  return points;
}

export function seriesToCsv(points: ActiveUsersPoint[]): string {
  const header = 'date,dau,wau,mau';
  const rows = points.map((p) => `${p.date},${p.dau},${p.wau},${p.mau}`);
  return [header, ...rows].join('\n');
}
