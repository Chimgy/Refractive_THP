// Shared constants, mock-data generators and formatting helpers for the
// DORA widget family (doraScorecards, doraSpeedStability, doraLeadTime*,
// doraDistribution, doraDeployments, doraIncidents). These all view the same
// underlying "DORA metrics" mock dataset, so — unlike the other widget
// families, which are each fully standalone — it's one shared module rather
// than seven copies of the same generators.
import { mulberry32 } from '../mockSeeded';
import type { RangeOption } from '../common/RangeSelect';

export type Range = '30d' | '90d' | '180d' | '365d';
export type MetricId = 'ltc' | 'review' | 'ci' | 'mttr';
export type Tier = 'Elite' | 'High' | 'Medium' | 'Low';

export const RANGE_OPTIONS: RangeOption<Range>[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '180d', label: '180 days' },
  { value: '365d', label: '1 year' },
];

const BUCKET_COUNT: Record<Range, number> = { '30d': 6, '90d': 12, '180d': 18, '365d': 18 };

export const STAGES = [
  { key: 'coding', name: 'Coding / PR', short: 'code', tone: '#7b5ce0', hours: 6.4, p95: 41 },
  { key: 'review', name: 'Review / queue', short: 'review', tone: '#e0a33b', hours: 18.2, p95: 96 },
  { key: 'ci', name: 'Build / test', short: 'ci', tone: '#35c08a', hours: 1.1, p95: 3.4 },
  { key: 'deploy', name: 'Deploy', short: 'deploy', tone: 'rgba(237,237,240,.42)', hours: 0.55, p95: 1.8 },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];

export const METRICS: {
  id: MetricId;
  label: string;
  title: string;
  n: number;
  median: number;
  sigma: number;
  tone: string;
  edges: number[];
}[] = [
  { id: 'ltc', label: 'Lead time', title: 'Lead time for changes', n: 214, median: 26, sigma: 1.15, tone: '#7b5ce0', edges: [0, 1, 2, 4, 8, 16, 24, 48, 96, 168] },
  { id: 'review', label: 'Review', title: 'Review / queue time', n: 214, median: 18, sigma: 1.35, tone: '#e0a33b', edges: [0, 1, 2, 4, 8, 16, 24, 48, 96, 168] },
  { id: 'ci', label: 'Build', title: 'Build / test duration', n: 214, median: 1.1, sigma: 0.5, tone: '#35c08a', edges: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6] },
  { id: 'mttr', label: 'MTTR', title: 'Time to restore', n: 41, median: 2.4, sigma: 1.05, tone: '#e2564d', edges: [0, 0.5, 1, 2, 4, 8, 16, 24, 48, 96] },
];

export const METRIC_OPTIONS: RangeOption<MetricId>[] = METRICS.map((m) => ({ value: m.id, label: m.label }));

export const TIER_TONE: Record<Tier, { bg: string; fg: string }> = {
  Elite: { bg: 'rgba(53,192,138,.14)', fg: 'var(--good)' },
  High: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)' },
  Medium: { bg: 'rgba(224,163,59,.14)', fg: 'var(--warn)' },
  Low: { bg: 'rgba(226,86,77,.14)', fg: 'var(--bad)' },
};

export const axis = {
  stroke: 'rgba(237,237,240,.3)',
  fontSize: 10.5,
  fontFamily: 'var(--mono)',
  tickLine: false,
  axisLine: false,
};

export const tooltipStyle = {
  background: '#0f0f14',
  border: '1px solid rgba(255,255,255,.13)',
  borderRadius: 7,
  font: '11.5px var(--mono)',
  color: '#ededf0',
};

// A light, low-opacity grey rect on hover instead of recharts' bright
// default cursor fill — matches GrowthIndicatorWidget's HOVER_CURSOR.
export const HOVER_CURSOR = { fill: 'rgba(237,237,240,.07)' };

export function hrs(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

// Compact axis labels: unit stated once per side, "1–2h" / "24h–2d" / "7d+".
export function binLabel(lo: number, hi: number | undefined): string {
  const part = (v: number) => {
    if (v < 1) return { n: String(Math.round(v * 60)), u: 'm' };
    if (v < 48) return { n: (Math.round(v * 10) / 10).toString().replace(/\.0$/, ''), u: 'h' };
    return { n: (Math.round((v / 24) * 10) / 10).toString().replace(/\.0$/, ''), u: 'd' };
  };
  const a = part(lo);
  if (hi == null) return `${a.n}${a.u}+`;
  const b = part(hi);
  if (lo === 0) return `<${b.n}${b.u}`;
  return a.u === b.u ? `${a.n}–${b.n}${b.u}` : `${a.n}${a.u}–${b.n}${b.u}`;
}

function binOf(edges: number[], v: number): { index: number; frac: number } {
  for (let i = 0; i < edges.length - 1; i++) {
    if (v < edges[i + 1]) return { index: i, frac: (v - edges[i]) / (edges[i + 1] - edges[i]) };
  }
  const last = edges.length - 1;
  return { index: last, frac: Math.min(0.95, (v - edges[last]) / (edges[last] || 1)) };
}

// ---------------------------------------------------------------------------
// Weekly bucket series — deployment frequency, change failure rate, and a
// per-stage lead-time breakdown, all bucketed over the selected window.
// ---------------------------------------------------------------------------

export type WeekBucket = { label: string; df: number; cfr: number; stack: Record<StageKey, number> };

export function generateSeries(range: Range, seed: number): WeekBucket[] {
  const n = BUCKET_COUNT[range];
  const rand = mulberry32(seed + n * 977 + 41);
  const out: WeekBucket[] = [];
  for (let i = 0; i < n; i++) {
    const ramp = i / Math.max(1, n - 1);
    const df = Math.max(0.35, 1.1 + ramp * 1.5 + (rand() - 0.5) * 0.55);
    const cfr = Math.max(4, 22 - ramp * 8 + (rand() - 0.5) * 5);
    const scale = 1.35 - ramp * 0.5 + (rand() - 0.5) * 0.25;
    const stack = {} as Record<StageKey, number>;
    for (const s of STAGES) stack[s.key] = s.hours * scale * (0.75 + rand() * 0.5);
    out.push({ label: `W${String(i + 1).padStart(2, '0')}`, df, cfr, stack });
  }
  return out;
}

// A seeded ±15% jitter on the fixed stage baseline — the only thing that
// makes the (otherwise-static) stage breakdown respond to Refresh.
export function jitterStages(seed: number) {
  const rand = mulberry32(seed + 641);
  return STAGES.map((s) => {
    const factor = 0.85 + rand() * 0.3;
    return { ...s, hours: s.hours * factor, p95: s.p95 * factor };
  });
}

// ---------------------------------------------------------------------------
// Distributions — a log-normal sample per metric, binned for the histogram
// and plotted individually for the raw strip.
// ---------------------------------------------------------------------------

function samplesFor(metric: (typeof METRICS)[number], seed: number): number[] {
  const rand = mulberry32(seed + metric.id.length * 7919 + metric.n);
  const out: number[] = [];
  for (let i = 0; i < metric.n; i++) {
    const u = Math.max(1e-9, rand());
    const v = rand();
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    out.push(Math.max(metric.edges[1] * 0.15, metric.median * Math.exp(metric.sigma * g)));
  }
  return out.sort((a, b) => a - b);
}

export type HistBin = { label: string; count: number; tone: string };
export type RugPoint = { x: number; y: number; tone: string };

export function distributionFor(metric: (typeof METRICS)[number], seed: number) {
  const vals = samplesFor(metric, seed);
  const edges = metric.edges;
  const nBins = edges.length;
  const counts = new Array(nBins).fill(0);
  const rugRand = mulberry32(seed + nBins * 131 + metric.n);
  const rug: RugPoint[] = vals.map((v) => {
    const { index, frac } = binOf(edges, v);
    counts[index]++;
    return {
      x: ((index + Math.min(0.98, Math.max(0.02, frac))) / nBins) * 100,
      y: 5 + rugRand() * 24,
      tone: v > metric.median * 3 ? 'var(--bad)' : 'rgba(237,237,240,.45)',
    };
  });
  const maxCount = Math.max(...counts);
  const modeIndex = counts.indexOf(maxCount);
  const hist: HistBin[] = counts.map((count, i) => {
    const isTail = i >= nBins - 2;
    return {
      label: binLabel(edges[i], edges[i + 1]),
      count,
      tone: isTail ? 'var(--bad)' : i === modeIndex ? metric.tone : `${metric.tone}cc`,
    };
  });
  const tailCount = vals.filter((v) => v >= edges[nBins - 2]).length;
  const median = vals[Math.floor(vals.length / 2)];
  return {
    hist,
    rug,
    stats: [
      { label: 'Events', value: String(metric.n), tone: 'var(--text)' },
      { label: 'Mode bin', value: hist[modeIndex].label, tone: metric.tone },
      { label: 'Median', value: hrs(median), tone: 'var(--text)' },
      { label: 'Long tail', value: `${tailCount} ≥ ${hrs(edges[nBins - 2])}`, tone: 'var(--bad)' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Deployment history + incidents — small mock pools shuffled deterministically
// per seed, so Refresh produces a plausible-looking new set each time.
// ---------------------------------------------------------------------------

export type DeployStatus = 'SUCCESS' | 'HOTFIX' | 'ROLLBACK';
export const STATUS_TONE: Record<DeployStatus, { bg: string; fg: string }> = {
  SUCCESS: { bg: 'rgba(53,192,138,.14)', fg: 'var(--good)' },
  HOTFIX: { bg: 'rgba(224,163,59,.14)', fg: 'var(--warn)' },
  ROLLBACK: { bg: 'rgba(226,86,77,.14)', fg: 'var(--bad)' },
};

export type Severity = 'SEV1' | 'SEV2' | 'SEV3';
export const SEV_TONE: Record<Severity, { bg: string; fg: string }> = {
  SEV1: { bg: 'rgba(226,86,77,.14)', fg: 'var(--bad)' },
  SEV2: { bg: 'rgba(224,163,59,.14)', fg: 'var(--warn)' },
  SEV3: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)' },
};

const SERVICES = ['api-gateway', 'telemetry-ingest', 'web-portal', 'auth-service', 'billing-worker'];
const AUTHORS = ['m.okafor', 'j.lindqvist', 'a.khan', 'r.duarte', 's.varga'];

function randomSha(rand: () => number): string {
  let out = '';
  for (let i = 0; i < 7; i++) out += Math.floor(rand() * 16).toString(16);
  return out;
}

function formatAgo(hoursAgo: number): string {
  if (hoursAgo < 24) return `${Math.max(1, Math.round(hoursAgo))}h ago`;
  if (hoursAgo < 48) return 'yesterday';
  return `${Math.round(hoursAgo / 24)}d ago`;
}

export type Deploy = {
  sha: string;
  service: string;
  meta: string;
  coding: string;
  review: string;
  ci: string;
  lead: string;
  reviewTone: string;
  status: DeployStatus;
};

// Window-total count shown in the meta line and the "all N →" link — the
// table itself only ever lists a recent sample, not every deploy in the
// window.
export const DEPLOY_COUNT = 214;
export const INCIDENT_COUNT = 9;

export function generateDeploys(seed: number, count = 9): Deploy[] {
  const rand = mulberry32(seed + 991);
  const rows: Deploy[] = [];
  let hoursAgo = 1 + rand() * 3;
  for (let i = 0; i < count; i++) {
    const coding = 0.5 + rand() * 12;
    const review = 1 + rand() * rand() * 90;
    const ci = 0.4 + rand() * 2;
    const lead = coding + review + ci + 0.4;
    const statusRoll = rand();
    const status: DeployStatus = statusRoll < 0.68 ? 'SUCCESS' : statusRoll < 0.87 ? 'HOTFIX' : 'ROLLBACK';
    rows.push({
      sha: randomSha(rand),
      service: SERVICES[Math.floor(rand() * SERVICES.length)],
      meta: `${formatAgo(hoursAgo)} · ${AUTHORS[Math.floor(rand() * AUTHORS.length)]}`,
      coding: hrs(coding),
      review: hrs(review),
      ci: hrs(ci),
      lead: hrs(lead),
      reviewTone: review >= 24 ? 'var(--bad)' : review >= 12 ? 'var(--warn)' : 'var(--muted)',
      status,
    });
    hoursAgo += 2 + rand() * 22;
  }
  return rows;
}

export type Incident = {
  id: string;
  service: string;
  sev: Severity;
  trigger: string;
  detected: string;
  fix: string;
  mttr: string;
  detectPct: number;
  fixPct: number;
};

export function generateIncidents(seed: number, count = 4): Incident[] {
  const rand = mulberry32(seed + 3271);
  const rows: Incident[] = [];
  let idNum = 4200 - Math.floor(rand() * 40);
  for (let i = 0; i < count; i++) {
    const detect = 0.1 + rand() * rand() * 2.5;
    const fix = 0.5 + rand() * rand() * 8;
    const total = detect + fix;
    const sevRoll = rand();
    const sev: Severity = sevRoll < 0.25 ? 'SEV1' : sevRoll < 0.7 ? 'SEV2' : 'SEV3';
    rows.push({
      id: `INC-${idNum}`,
      service: SERVICES[Math.floor(rand() * SERVICES.length)],
      sev,
      trigger: randomSha(rand),
      detected: hrs(detect),
      fix: hrs(fix),
      mttr: hrs(total),
      detectPct: (detect / total) * 100,
      fixPct: (fix / total) * 100,
    });
    idNum -= 3 + Math.floor(rand() * 8);
  }
  return rows;
}
