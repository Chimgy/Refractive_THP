// Hardcoded fixtures standing in for the API. Swap each export for a fetch
// against the Nest backend when the endpoints land.

export type Stage = 'live' | 'dev' | 'partial';

export type Project = {
  id: string;
  name: string;
  repo: string | null;
  stage: Stage;
  deployFreq: string | null;
  leadTime: string | null;
  sources: string[];
  trend: number[];
  trendTone: 'good' | 'bad' | 'warn';
};

export const projects: Project[] = [
  {
    id: 'portal-api',
    name: 'portal-api',
    repo: 'thp/portal-api',
    stage: 'live',
    deployFreq: '4.2/wk',
    leadTime: '18.4h',
    sources: ['GH', 'CF'],
    trend: [20, 17, 19, 12, 14, 8, 5],
    trendTone: 'good',
  },
  {
    id: 'checkout-web',
    name: 'checkout-web',
    repo: 'thp/checkout-web',
    stage: 'live',
    deployFreq: '2.8/wk',
    leadTime: '31.0h',
    sources: ['GH', 'AWS', 'TEL'],
    trend: [10, 12, 9, 15, 13, 18, 20],
    trendTone: 'bad',
  },
  {
    id: 'insights-worker',
    name: 'insights-worker',
    repo: 'thp/insights-worker',
    stage: 'dev',
    deployFreq: '6.5/wk',
    leadTime: '7.2h',
    sources: ['GH'],
    trend: [18, 14, 16, 10, 11, 6, 4],
    trendTone: 'good',
  },
  {
    id: 'marketing-site',
    name: 'marketing-site',
    repo: null,
    stage: 'partial',
    deployFreq: null,
    leadTime: null,
    sources: ['CF', 'TEL'],
    trend: [],
    trendTone: 'warn',
  },
  {
    id: 'billing-svc',
    name: 'billing-svc',
    repo: 'thp/billing-svc',
    stage: 'dev',
    deployFreq: '1.1/wk',
    leadTime: '62.8h',
    sources: ['GH'],
    trend: [8, 11, 10, 14, 16, 15, 19],
    trendTone: 'warn',
  },
];

export const deploymentSeries = [
  { week: 'W1', deploys: 2 },
  { week: 'W2', deploys: 3 },
  { week: 'W3', deploys: 2 },
  { week: 'W4', deploys: 4 },
  { week: 'W5', deploys: 3 },
  { week: 'W6', deploys: 5 },
  { week: 'W7', deploys: 3 },
  { week: 'W8', deploys: 6 },
  { week: 'W9', deploys: 4 },
  { week: 'W10', deploys: 7 },
  { week: 'W11', deploys: 5 },
  { week: 'W12', deploys: 8 },
];

export const leadTimeSeries = deploymentSeries.map((d, i) => ({
  week: d.week,
  p50: [22, 19, 26, 20, 30, 26, 34, 30, 38, 33, 40, 18.4][i],
  p90: [48, 44, 55, 46, 62, 57, 70, 63, 76, 68, 80, 41][i],
}));

export const leadTimeBuckets = [
  { bucket: '< 6h', count: 31, pct: 58, tone: 'var(--accent)' },
  { bucket: '6–24h', count: 44, pct: 82, tone: 'var(--accent)' },
  { bucket: '1–3d', count: 22, pct: 41, tone: 'rgba(123,92,224,.6)' },
  { bucket: '> 3d', count: 8, pct: 15, tone: 'var(--warn)' },
];

export const latencySeries = [
  { t: '00:00', p50: 84, p99: 240 },
  { t: '04:00', p50: 78, p99: 214 },
  { t: '08:00', p50: 96, p99: 288 },
  { t: '12:00', p50: 132, p99: 402 },
  { t: '16:00', p50: 118, p99: 356 },
  { t: '20:00', p50: 92, p99: 262 },
  { t: '24:00', p50: 81, p99: 228 },
];

export const utilisation = [
  { name: 'ECS CPU', value: 42, cap: 100, tone: 'var(--accent)' },
  { name: 'ECS memory', value: 61, cap: 100, tone: 'var(--accent)' },
  { name: 'RDS connections', value: 78, cap: 100, tone: 'var(--warn)' },
  { name: 'RDS storage', value: 34, cap: 100, tone: 'var(--accent)' },
];

export const errorBudget = [
  { code: '2xx', share: 97.8, tone: 'var(--good)' },
  { code: '4xx', share: 1.9, tone: 'var(--warn)' },
  { code: '5xx', share: 0.3, tone: 'var(--bad)' },
];

export const trafficSeries = [
  { day: 'Mon', views: 4200, sessions: 1650 },
  { day: 'Tue', views: 4810, sessions: 1820 },
  { day: 'Wed', views: 5240, sessions: 1990 },
  { day: 'Thu', views: 4980, sessions: 1910 },
  { day: 'Fri', views: 6120, sessions: 2280 },
  { day: 'Sat', views: 3150, sessions: 1240 },
  { day: 'Sun', views: 2890, sessions: 1120 },
];

export const topPages = [
  { path: '/', views: 9840, avg: '01:12' },
  { path: '/pricing', views: 4210, avg: '02:04' },
  { path: '/docs/quickstart', views: 3180, avg: '03:41' },
  { path: '/login', views: 2440, avg: '00:38' },
  { path: '/changelog', views: 1120, avg: '01:27' },
];

export const taggedClicks = [
  { tag: 'cta_signup', count: 812 },
  { tag: 'nav_docs', count: 604 },
  { tag: 'pricing_toggle', count: 388 },
  { tag: 'footer_github', count: 156 },
];

export const pollActivity = [
  { tone: 'var(--good)', title: 'GitHub poll complete', meta: '14:00 · 6 releases, 41 PRs' },
  { tone: 'var(--good)', title: 'Cloudflare zone poll', meta: '14:00 · 184k req, 91% cache hit' },
  { tone: 'var(--warn)', title: 'CloudWatch not connected', meta: 'Add a read-only IAM role to enable' },
  { tone: 'var(--accent)', title: 'Telemetry ingest', meta: '2,904 events last 24h' },
];

export const connections = [
  { name: 'GitHub', status: 'CONNECTED' as const },
  { name: 'Cloudflare', status: 'CONNECTED' as const },
  { name: 'AWS CloudWatch', status: 'CONNECT' as const },
];
