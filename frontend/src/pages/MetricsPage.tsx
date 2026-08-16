import { Fragment, useState } from 'react';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import Sparkline from '../components/Sparkline';

type Category = 'ENGAGEMENT' | 'PERFORMANCE' | 'RELIABILITY';
type DomainTab = 'telemetry' | 'postdev' | 'indev';

const CATEGORY_TONE: Record<Category, { bg: string; fg: string }> = {
  ENGAGEMENT: { bg: 'rgba(224,163,59,.14)', fg: 'var(--warn)' },
  PERFORMANCE: { bg: 'rgba(94,164,240,.14)', fg: '#7fb2f0' },
  RELIABILITY: { bg: 'rgba(226,86,77,.14)', fg: 'var(--bad)' },
};

const FILTERS: ('ALL' | Category)[] = [
  'ALL',
  'ENGAGEMENT',
  'PERFORMANCE',
  'RELIABILITY',
];

function CategoryPill({ category }: { category: Category }) {
  const tone = CATEGORY_TONE[category];
  return (
    <span
      className="pill"
      style={{ background: tone.bg, color: tone.fg, fontSize: 9.5 }}
    >
      {category}
    </span>
  );
}

function MetricRow({
  n,
  title,
  category,
  why,
  how,
  children,
}: {
  n: string;
  title: string;
  category: Category;
  why: string;
  how: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--panel)',
        padding: '26px 28px',
        display: 'grid',
        gridTemplateColumns: '1fr 430px',
        gap: 44,
        alignItems: 'start',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'rgba(237,237,240,.28)',
            }}
          >
            {n}
          </span>
          <h3
            style={{
              margin: 0,
              font: '500 17px var(--sans)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>
          <CategoryPill category={category} />
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <div className="label">WHY IT MATTERS</div>
            <p
              style={{
                margin: '7px 0 0',
                maxWidth: '46em',
                font: '400 13px/1.65 var(--sans)',
                color: 'var(--muted)',
                textWrap: 'pretty',
              }}
            >
              {why}
            </p>
          </div>
          <div>
            <div className="label">HOW IT&apos;S BUILT</div>
            <p
              style={{
                margin: '7px 0 0',
                maxWidth: '46em',
                font: '400 13px/1.65 var(--sans)',
                color: 'var(--muted)',
                textWrap: 'pretty',
              }}
            >
              {how}
            </p>
          </div>
        </div>
      </div>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 9,
          background: 'var(--panel-2)',
          padding: '16px 18px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Exported for DashboardPage.tsx's LCP/TTFB widgets, which reuse this exact
// visual language rather than re-implementing it — same reasoning as
// BigStat/BarRow below.
export function VisualHead({
  label,
  tag,
  tagTone,
}: {
  label: string;
  tag: string;
  tagTone?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}
    >
      <span className="label" style={{ fontSize: 10 }}>
        {label}
      </span>
      <span
        className="mono"
        style={{ fontSize: 9.5, color: tagTone ?? 'rgba(237,237,240,.28)' }}
      >
        {tag}
      </span>
    </div>
  );
}

export function BigStat({
  value,
  unit,
  delta,
}: {
  value: string;
  unit?: string;
  delta?: string;
}) {
  return (
    <div
      style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 9 }}
    >
      <span className="mono" style={{ fontSize: 30, color: 'var(--text)' }}>
        {value}
      </span>
      {unit ? (
        <span
          className="mono"
          style={{ fontSize: 12, color: 'rgba(237,237,240,.35)' }}
        >
          {unit}
        </span>
      ) : null}
      {delta ? (
        <span
          className="mono"
          style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--good)' }}
        >
          {delta}
        </span>
      ) : null}
    </div>
  );
}

export function BarRow({
  label,
  pct,
  value,
  tone = 'var(--accent)',
  labelWidth = 150,
}: {
  label: string;
  pct: number;
  value: string;
  tone?: string;
  labelWidth?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        className="mono"
        style={{
          flex: 'none',
          width: labelWidth,
          fontSize: 11.5,
          color: 'rgba(237,237,240,.62)',
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: 'rgba(255,255,255,.06)',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: 6,
            borderRadius: 3,
            background: tone,
          }}
        />
      </div>
      <span
        className="mono"
        style={{ flex: 'none', fontSize: 11, color: 'var(--text)' }}
      >
        {value}
      </span>
    </div>
  );
}

function ColumnBars({
  values,
  highlight,
}: {
  values: number[];
  highlight: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        alignItems: 'flex-end',
        height: 34,
        marginTop: 14,
      }}
    >
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${v}%`,
            background:
              i === highlight ? 'var(--accent)' : 'rgba(123,92,224,.5)',
          }}
        />
      ))}
    </div>
  );
}

function EmptyDomain({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ padding: '34px 54px 90px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2
          style={{
            margin: 0,
            font: '400 24px var(--sans)',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
        <span className="mono faint" style={{ fontSize: 11.5 }}>
          {subtitle}
        </span>
      </div>
      <div
        className="dashed"
        style={{
          marginTop: 24,
          padding: '70px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          className="mono"
          style={{
            padding: '3px 8px',
            borderRadius: 5,
            background: 'rgba(255,255,255,.06)',
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: 'var(--faint)',
          }}
        >
          NOT YET DEFINED
        </span>
        <div style={{ font: '400 15px var(--sans)', color: 'var(--muted)' }}>
          Metrics for this domain haven&apos;t been specified.
        </div>
      </div>
    </div>
  );
}

const DOMAIN_TABS: {
  id: DomainTab;
  label: string;
  badge: string;
  tone: 'live' | 'planned';
}[] = [
  { id: 'telemetry', label: 'Telemetry', badge: 'LIVE · 14', tone: 'live' },
  {
    id: 'postdev',
    label: 'Post-development',
    badge: 'PLANNED',
    tone: 'planned',
  },
  { id: 'indev', label: 'In-development', badge: 'PLANNED', tone: 'planned' },
];

export default function MetricsPage() {
  const [tab, setTab] = useState<DomainTab>('telemetry');
  const [filter, setFilter] = useState<'ALL' | Category>('ALL');

  const show = (category: Category) => filter === 'ALL' || filter === category;

  return (
    <div
      style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
    >
      <SiteHeader />

      <div style={{ padding: '44px 54px 0' }}>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.16em',
            color: 'var(--accent-text)',
            textTransform: 'uppercase',
          }}
        >
          Metrics
        </div>
        <h1
          style={{
            margin: '16px 0 0',
            font: '400 40px/1.1 var(--sans)',
            letterSpacing: '-0.03em',
          }}
        >
          Everything measured, and why.
        </h1>
        <p
          style={{
            margin: '16px 0 0',
            maxWidth: '44em',
            font: '400 14.5px/1.65 var(--sans)',
            color: 'var(--muted)',
            textWrap: 'pretty',
          }}
        >
          Three domains, three collectors. Each metric carries the write-up on
          the left and its default view on the right.
        </p>
      </div>

      <div className="tabs" style={{ padding: '0 54px', marginTop: 30 }}>
        {DOMAIN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 9 }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span
              className="mono"
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                background:
                  t.tone === 'live'
                    ? 'rgba(53,192,138,.14)'
                    : 'rgba(255,255,255,.06)',
                fontSize: 9,
                fontWeight: 500,
                color:
                  t.tone === 'live' ? 'var(--good)' : 'rgba(237,237,240,.4)',
              }}
            >
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {tab === 'telemetry' && (
        <div style={{ padding: '34px 54px 70px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 40,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h2
                  style={{
                    margin: 0,
                    font: '400 24px var(--sans)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Telemetry
                </h2>
                <span className="mono faint" style={{ fontSize: 11.5 }}>
                  THP_analytics.js — live website user telemetry
                </span>
              </div>
              <p
                style={{
                  margin: '12px 0 0',
                  maxWidth: '52em',
                  font: '400 13.5px/1.65 var(--sans)',
                  color: 'var(--muted)',
                  textWrap: 'pretty',
                }}
              >
                A first-party, ~2KB script served at{' '}
                <code>/THP_analytics.js</code>. Cookieless, batched, and flushed
                via <code>sendBeacon</code> on tab hide — everything below is
                either read straight off that batch or aggregated from it in
                Redis before landing in Postgres.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="mono"
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: `1px solid ${filter === f ? 'var(--border-strong)' : 'var(--border)'}`,
                    fontSize: 10.5,
                    fontWeight: 500,
                    color:
                      filter === f ? 'var(--text)' : 'rgba(237,237,240,.42)',
                  }}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              marginTop: 26,
              background: 'var(--border)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              overflow: 'hidden',
            }}
          >
            {show('ENGAGEMENT') && (
              <MetricRow
                n="01"
                title="Page views"
                category="ENGAGEMENT"
                why="Page-level traffic says which URLs actually earn attention, and where visitors enter and leave."
                how="One pageview event per navigation, queued client-side with the referrer and flushed via sendBeacon. The ingest worker HINCRBYs the URL into a 5-minute Redis hash that the rollup processor folds into telemetry_metrics."
              >
                <VisualHead label="PAGE VIEWS" tag="7D" />
                <BigStat value="48.2k" delta="+12.4%" />
                <div style={{ marginTop: 12 }}>
                  <Sparkline
                    points={[
                      52, 58, 54, 66, 62, 74, 70, 80, 76, 86, 82, 92, 88,
                    ]}
                    width={396}
                    height={70}
                  />
                </div>
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="02"
                title="Session start / end + duration"
                category="ENGAGEMENT"
                why="Session count and length separate a bounce from a real visit — the baseline every other engagement number gets read against."
                how="A UUID session id is minted once per tab into sessionStorage and reused across pageviews. session_end fires on visibilitychange/pagehide with the elapsed ms, deduped by session id and maxed at rollup since a backgrounded tab can fire it more than once."
              >
                <VisualHead label="SESSIONS" tag="7D" />
                <div style={{ marginTop: 10, display: 'flex', gap: 26 }}>
                  <div>
                    <div
                      className="mono"
                      style={{ fontSize: 26, color: 'var(--text)' }}
                    >
                      14.9k
                    </div>
                    <div
                      className="mono"
                      style={{
                        marginTop: 3,
                        fontSize: 10.5,
                        color: 'rgba(237,237,240,.35)',
                      }}
                    >
                      sessions
                    </div>
                  </div>
                  <div>
                    <div
                      className="mono"
                      style={{ fontSize: 26, color: 'var(--text)' }}
                    >
                      3:41
                    </div>
                    <div
                      className="mono"
                      style={{
                        marginTop: 3,
                        fontSize: 10.5,
                        color: 'rgba(237,237,240,.35)',
                      }}
                    >
                      median duration
                    </div>
                  </div>
                  <div>
                    <div
                      className="mono"
                      style={{ fontSize: 26, color: 'var(--text)' }}
                    >
                      1.9
                    </div>
                    <div
                      className="mono"
                      style={{
                        marginTop: 3,
                        fontSize: 10.5,
                        color: 'rgba(237,237,240,.35)',
                      }}
                    >
                      pages / session
                    </div>
                  </div>
                </div>
                <ColumnBars
                  values={[38, 56, 72, 100, 64, 48, 30]}
                  highlight={3}
                />
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="03"
                title="Tagged click events"
                category="ENGAGEMENT"
                why="Pageviews show where visitors land; tagged clicks show what they actually do — the CTAs, nav items and links worth watching."
                how="Opt-in via a data-thp-track attribute. A single delegated click listener walks up via closest(), and the tag is HINCRBY'd per 5-minute period — no per-element wiring needed on the tracked page."
              >
                <VisualHead label="TRACKED CLICKS" tag="27 TAGS" />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                    marginTop: 14,
                  }}
                >
                  <BarRow label="cta-book-call" pct={88} value="1,204" />
                  <BarRow label="nav-work" pct={61} value="842" />
                  <BarRow label="footer-email" pct={34} value="466" />
                  <BarRow label="case-study-open" pct={19} value="258" />
                </div>
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="04"
                title="Device context"
                category="ENGAGEMENT"
                why="Viewport and UA context explain layout and performance differences without fingerprinting anyone individually."
                how="Viewport size, user agent and navigator.language ride along on every batch as request metadata rather than a separate event, and are read back from that batch's payload at rollup time."
              >
                <VisualHead label="DEVICE MIX" tag="SESSIONS" />
                <div
                  style={{
                    display: 'flex',
                    height: 8,
                    borderRadius: 4,
                    overflow: 'hidden',
                    marginTop: 14,
                  }}
                >
                  <div style={{ width: '58%', background: 'var(--accent)' }} />
                  <div
                    style={{ width: '34%', background: 'rgba(123,92,224,.55)' }}
                  />
                  <div
                    style={{ width: '8%', background: 'rgba(123,92,224,.28)' }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  {[
                    ['mobile · ≤ 768px', '58%'],
                    ['desktop · ≥ 1280px', '34%'],
                    ['tablet', '8%'],
                  ].map(([l, v]) => (
                    <div
                      key={l}
                      className="mono"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11.5,
                        color: 'rgba(237,237,240,.62)',
                      }}
                    >
                      <span>{l}</span>
                      <span style={{ color: 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div
                  className="mono"
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,.07)',
                    fontSize: 11,
                    color: 'rgba(237,237,240,.35)',
                  }}
                >
                  top locale en-GB · 61%
                </div>
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="05"
                title="Unique visitors"
                category="ENGAGEMENT"
                why='Raw page views double-count returning visitors — a real unique count is what "how many people" means, without a cookie.'
                how="SHA-256(IP + UA + a daily-rotating salt) collapses one visitor's repeat POSTs within a day into one opaque id, PFADD'd into a Redis HyperLogLog per project per day. The salt rotates daily so the hash can't link the same visitor across days, even with the secret."
              >
                <VisualHead
                  label="UNIQUE VISITORS"
                  tag="COOKIELESS"
                  tagTone="var(--good)"
                />
                <BigStat value="11.6k" delta="+4.1%" />
                <ColumnBars
                  values={[52, 60, 48, 74, 82, 100, 66]}
                  highlight={5}
                />
                <div
                  className="mono"
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,.07)',
                    fontSize: 11,
                    color: 'rgba(237,237,240,.35)',
                  }}
                >
                  HLL estimate · ±1.6%
                </div>
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="06"
                title="Coarse geolocation"
                category="ENGAGEMENT"
                why="Knowing which countries visit shapes everything from cache/edge strategy to which locale to build for next."
                how="Read straight off Cloudflare's CF-IPCountry header at the edge — never the raw IP — and HINCRBY'd per country into the same 5-minute aggregation window as pages and clicks."
              >
                <VisualHead label="BY COUNTRY" tag="TOP 4" />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                    marginTop: 14,
                  }}
                >
                  <BarRow label="GB" pct={64} value="64%" labelWidth={74} />
                  <BarRow label="US" pct={21} value="21%" labelWidth={74} />
                  <BarRow label="DE" pct={8} value="8%" labelWidth={74} />
                  <BarRow
                    label="other"
                    pct={7}
                    value="7%"
                    labelWidth={74}
                    tone="rgba(123,92,224,.5)"
                  />
                </div>
                <div
                  className="mono"
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,.07)',
                    fontSize: 11,
                    color: 'rgba(237,237,240,.35)',
                  }}
                >
                  country only · IP discarded
                </div>
              </MetricRow>
            )}

            {show('PERFORMANCE') && (
              <MetricRow
                n="07"
                title="Largest Contentful Paint"
                category="PERFORMANCE"
                why="LCP is the Core Web Vital visitors feel most directly — how long the page looks broken or empty."
                how="A PerformanceObserver on largest-contentful-paint tracks the latest candidate. The value is pushed onto a per-period Redis list and the rollup computes a percentile from the full list before the key expires."
              >
                <VisualHead label="LCP p75" tag="GOOD" tagTone="var(--good)" />
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 30, color: 'var(--text)' }}
                  >
                    1.84
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: 'rgba(237,237,240,.35)' }}
                  >
                    s
                  </span>
                </div>
                <div
                  style={{
                    position: 'relative',
                    height: 8,
                    borderRadius: 4,
                    marginTop: 16,
                    background:
                      'linear-gradient(90deg, var(--good) 0 42%, var(--warn) 42% 72%, var(--bad) 72% 100%)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      left: '31%',
                      width: 2,
                      height: 16,
                      background: 'var(--text)',
                    }}
                  />
                </div>
                <div
                  className="mono"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 8,
                    fontSize: 10.5,
                    color: 'rgba(237,237,240,.35)',
                  }}
                >
                  <span>0s</span>
                  <span>2.5s</span>
                  <span>4.0s</span>
                  <span>6s</span>
                </div>
              </MetricRow>
            )}

            {show('PERFORMANCE') && (
              <MetricRow
                n="08"
                title="Time to First Byte"
                category="PERFORMANCE"
                why="TTFB isolates server/edge latency from render latency, so a raise in it points at infra or cache config, not the page itself."
                how="Read from the Navigation Timing API (responseStart) at the same flush points as LCP, sampled into the identical list-then-percentile rollup shape."
              >
                <VisualHead label="TTFB p75" tag="BY CACHE" />
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 30, color: 'var(--text)' }}
                  >
                    214
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: 'rgba(237,237,240,.35)' }}
                  >
                    ms
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                    marginTop: 16,
                  }}
                >
                  <BarRow
                    label="HIT"
                    pct={26}
                    value="61ms"
                    tone="var(--good)"
                    labelWidth={64}
                  />
                  <BarRow
                    label="MISS"
                    pct={88}
                    value="408ms"
                    tone="var(--warn)"
                    labelWidth={64}
                  />
                </div>
              </MetricRow>
            )}

            {show('PERFORMANCE') && (
              <MetricRow
                n="09"
                title="Navigation timing"
                category="PERFORMANCE"
                why="Breaking load into DNS/TCP/DOM/complete phases says which phase is actually worth going to fix."
                how="Pulled wholesale from performance.getEntriesByType('navigation')[0] in the same vitals event as LCP and TTFB, so all three land in one flush."
              >
                <VisualHead label="LOAD PHASES" tag="total 1.42s" />
                <div
                  style={{
                    display: 'flex',
                    height: 10,
                    borderRadius: 5,
                    overflow: 'hidden',
                    marginTop: 14,
                  }}
                >
                  <div style={{ width: '9%', background: 'var(--accent)' }} />
                  <div
                    style={{ width: '13%', background: 'rgba(123,92,224,.72)' }}
                  />
                  <div
                    style={{ width: '46%', background: 'rgba(123,92,224,.48)' }}
                  />
                  <div
                    style={{ width: '32%', background: 'rgba(123,92,224,.26)' }}
                  />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px 18px',
                    marginTop: 14,
                  }}
                >
                  {[
                    ['DNS', '28ms'],
                    ['TCP + TLS', '96ms'],
                    ['DOM load', '654ms'],
                    ['complete', '1.42s'],
                  ].map(([l, v]) => (
                    <div
                      key={l}
                      className="mono"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11.5,
                        color: 'rgba(237,237,240,.62)',
                      }}
                    >
                      <span>{l}</span>
                      <span style={{ color: 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="10"
                title="Active dwell time"
                category="ENGAGEMENT"
                why="Wall-clock time on a page overcounts an abandoned background tab; active time is closer to real attention."
                how="A start/pause/resume state machine pauses on tab-hidden and after 30s with no mouse, key, scroll or click activity, so AFK time never accrues."
              >
                <VisualHead label="ACTIVE DWELL" tag="AFK FILTERED" />
                <div style={{ marginTop: 10, display: 'flex', gap: 26 }}>
                  <div>
                    <div
                      className="mono"
                      style={{ fontSize: 26, color: 'var(--text)' }}
                    >
                      1:52
                    </div>
                    <div
                      className="mono"
                      style={{
                        marginTop: 3,
                        fontSize: 10.5,
                        color: 'rgba(237,237,240,.35)',
                      }}
                    >
                      median active
                    </div>
                  </div>
                  <div>
                    <div
                      className="mono"
                      style={{ fontSize: 26, color: 'rgba(237,237,240,.45)' }}
                    >
                      3:41
                    </div>
                    <div
                      className="mono"
                      style={{
                        marginTop: 3,
                        fontSize: 10.5,
                        color: 'rgba(237,237,240,.35)',
                      }}
                    >
                      wall clock
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'rgba(255,255,255,.06)',
                    }}
                  >
                    <div
                      style={{
                        width: '51%',
                        height: 6,
                        borderRadius: 3,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                  <div
                    className="mono"
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: 'rgba(237,237,240,.35)',
                    }}
                  >
                    51% of open time counted as attention
                  </div>
                </div>
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="11"
                title="Scroll depth milestones"
                category="ENGAGEMENT"
                why="Scroll depth says whether visitors actually read the page or bounced above the fold."
                how="A throttled scroll listener checks position against the 25/50/75/100% marks once per page load, firing each milestone at most once."
              >
                <VisualHead label="SCROLL DEPTH" tag="% OF VIEWS" />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                    marginTop: 14,
                  }}
                >
                  <BarRow label="25%" pct={92} value="92%" labelWidth={44} />
                  <BarRow label="50%" pct={61} value="61%" labelWidth={44} />
                  <BarRow label="75%" pct={38} value="38%" labelWidth={44} />
                  <BarRow label="100%" pct={24} value="24%" labelWidth={44} />
                </div>
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="12"
                title="Top pages"
                category="ENGAGEMENT"
                why='The ranked view of #1 answers "what&apos;s actually getting read" at a glance.'
                how="The same per-period Redis hash behind page views, just read back sorted by count instead of summed into a single total."
              >
                <VisualHead label="TOP PAGES" tag="VIEWS · 7D" />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    marginTop: 14,
                  }}
                >
                  {[
                    ['/', '18,402'],
                    ['/work', '9,144'],
                    ['/work/portal', '6,027'],
                    ['/contact', '3,318'],
                  ].map(([p, v], i, arr) => (
                    <div
                      key={p}
                      className="mono"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom:
                          i === arr.length - 1
                            ? 'none'
                            : '1px solid rgba(255,255,255,.06)',
                        fontSize: 11.5,
                        color: 'rgba(237,237,240,.62)',
                      }}
                    >
                      <span>{p}</span>
                      <span style={{ color: 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </MetricRow>
            )}

            {show('ENGAGEMENT') && (
              <MetricRow
                n="13"
                title="UTM attribution"
                category="ENGAGEMENT"
                why="Knowing which channel drove a session is the other half of traffic — not just how many, but where from."
                how="source/medium/campaign are parsed from the query string once at session start, not re-parsed per pageview — otherwise a second pageview with no query string would silently drop attribution — and cached in sessionStorage for the rest of the session."
              >
                <VisualHead label="ATTRIBUTION" tag="SESSIONS" />
                <div
                  className="mono"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: '8px 14px',
                    marginTop: 14,
                    fontSize: 11.5,
                  }}
                >
                  <span style={{ color: 'rgba(237,237,240,.3)' }}>source</span>
                  <span style={{ color: 'rgba(237,237,240,.3)' }}>medium</span>
                  <span
                    style={{
                      color: 'rgba(237,237,240,.3)',
                      textAlign: 'right',
                    }}
                  >
                    n
                  </span>
                  {[
                    ['linkedin', 'social', '2,410'],
                    ['newsletter', 'email', '1,188'],
                    ['google', 'cpc', '614'],
                    ['(direct)', 'none', '10,688'],
                  ].map(([s, m, n]) => (
                    <Fragment key={s}>
                      <span style={{ color: 'rgba(237,237,240,.65)' }}>
                        {s}
                      </span>
                      <span style={{ color: 'rgba(237,237,240,.45)' }}>
                        {m}
                      </span>
                      <span
                        style={{ color: 'var(--text)', textAlign: 'right' }}
                      >
                        {n}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </MetricRow>
            )}

            {show('RELIABILITY') && (
              <MetricRow
                n="14"
                title="JS client errors"
                category="RELIABILITY"
                why="A spike in one error is usually the earliest signal something just broke in production."
                how="Runtime error events are fingerprinted by SHA-256(message + file + line + col) and upserted with count = count + n, so the same crash repeating doesn't flood the table with duplicate rows."
              >
                <VisualHead
                  label="CLIENT ERRORS"
                  tag="6 UNIQUE"
                  tagTone="var(--bad)"
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    marginTop: 14,
                  }}
                >
                  {[
                    ['TypeError: t is undefined · app.js:214', '118'],
                    ['NetworkError: fetch failed · api.js:41', '62'],
                    ['Unhandled rejection · media.js:8', '34'],
                  ].map(([msg, count], i, arr) => (
                    <div
                      key={msg}
                      className="mono"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '8px 0',
                        borderBottom:
                          i === arr.length - 1
                            ? 'none'
                            : '1px solid rgba(255,255,255,.06)',
                        fontSize: 11.5,
                      }}
                    >
                      <span
                        style={{
                          color: 'rgba(237,237,240,.62)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {msg}
                      </span>
                      <span style={{ flex: 'none', color: 'var(--text)' }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className="mono"
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,.07)',
                    fontSize: 11,
                    color: 'rgba(237,237,240,.35)',
                  }}
                >
                  214 total · deduped by fingerprint
                </div>
              </MetricRow>
            )}
          </div>
        </div>
      )}

      {tab === 'postdev' && (
        <EmptyDomain
          title="Post-development"
          subtitle="Cloudflare / AWS infra — live site devops information"
        />
      )}

      {tab === 'indev' && (
        <EmptyDomain title="In-development" subtitle="GitHub DORA metrics" />
      )}

      <SiteFooter />
    </div>
  );
}
