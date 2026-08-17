import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// One row per (project, 5-minute period) — what TelemetryRollupProcessor
// writes after reading and discarding that period's Redis aggregate keys
// (telemetry-aggregation-keys.util.ts). The dashboard reads only this
// table, never Redis or raw events directly — cheap, pre-aggregated,
// bounded by (projects × periods), not by event volume.
//
// Renamed from `telemetry_metrics` (see migration AddEdgeMetricsAndSdkRename)
// to make explicit that everything here comes from the embed script/SDK —
// Cloudflare-sourced edge data (cache HIT/MISS, edge location) lives in the
// separate `edgelog_metrics` table instead, never here. That split restores
// the "three data domains" separation external_data.md section 1 already
// documents (telemetry / GitHub DORA / AWS+Cloudflare infra polling), and
// avoids coupling a Cloudflare-only writer to this table's NOT NULL jsonb
// breakdown columns (see EdgeLogMetric for why that coupling was a problem).
//
// `periodSeconds` is stored rather than assumed, so a later change to the
// rollup cadence doesn't silently reinterpret historical rows as covering
// the wrong window.
//
// Breakdown fields (topPages/taggedClicks/countries/scrollDepth/utmSources/
// eventTypeCounts) are jsonb arrays of `{key, count}` — same reasoning as
// telemetry_events.data used to be: these evolve as the script adds new
// event types, and forcing a migration per new breakdown isn't worth it.
@Entity('sdk_telemetry_metrics')
@Index(['projectId', 'periodStart'], { unique: true })
export class SdkTelemetryMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'int' })
  periodSeconds: number;

  @Column({ type: 'int', default: 0 })
  pageViews: number;

  @Column({ type: 'int', default: 0 })
  sessions: number;

  @Column({ type: 'jsonb' })
  topPages: { key: string; count: number }[];

  @Column({ type: 'jsonb' })
  taggedClicks: { key: string; count: number }[];

  @Column({ type: 'jsonb' })
  countries: { key: string; count: number }[];

  @Column({ type: 'jsonb' })
  scrollDepth: { key: string; count: number }[];

  @Column({ type: 'jsonb' })
  utmSources: { key: string; count: number }[];

  @Column({ type: 'jsonb' })
  eventTypeCounts: { key: string; count: number }[];

  // Added after this table already had rows in some environments — a plain
  // NOT NULL jsonb column fails TypeORM's `synchronize` ALTER TABLE against
  // existing data, so these two (unlike the breakdown columns above, which
  // predate any rows) need an explicit default.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  devices: { key: string; count: number }[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  locales: { key: string; count: number }[];

  // Blended across cold + cache-primed navigations (see lcpCold*/lcpCached*
  // below for the split). lcpCount/ttfbCount are the sample counts backing
  // these percentiles each period — added alongside the new metrics below so
  // TelemetryMetricsQueryService can weight cross-period folding by volume
  // instead of averaging every period's percentile equally regardless of how
  // many samples it actually saw.
  @Column({ type: 'numeric', nullable: true })
  lcpP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  lcpP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  lcpP99: string | null;

  @Column({ type: 'int', default: 0 })
  lcpCount: number;

  @Column({ type: 'numeric', nullable: true })
  ttfbP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  ttfbP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  ttfbP99: string | null;

  @Column({ type: 'int', default: 0 })
  ttfbCount: number;

  @Column({ type: 'numeric', nullable: true })
  dwellAvgMs: string | null;

  @Column({ type: 'numeric', nullable: true })
  dwellP50: string | null;

  // Despite the name, this is *active* session time (activeMs, preferred
  // over durationMs — see telemetry-aggregation.service.ts's session_end
  // handling), not wall-clock session length. sessionWall* below is the
  // true wall-clock counterpart, added later once that gap was noticed —
  // kept as separate columns rather than renaming these, since these are
  // already read elsewhere by name.
  @Column({ type: 'numeric', nullable: true })
  sessionDurationAvgMs: string | null;

  @Column({ type: 'numeric', nullable: true })
  sessionDurationP50: string | null;

  // True wall-clock session length (Date.now() - startedAt on the client),
  // always populated from session_end's durationMs regardless of whether
  // activeMs is also present — see sessionWallKey's own comment.
  @Column({ type: 'numeric', nullable: true })
  sessionWallAvgMs: string | null;

  @Column({ type: 'numeric', nullable: true })
  sessionWallP50: string | null;

  @Column({ type: 'int', default: 0 })
  sessionWallCount: number;

  // Distribution of wall-clock session durations across fixed buckets (see
  // SESSION_WALL_DURATION_BUCKETS in telemetry-rollup.processor.ts) — for
  // the "Session start / end + duration" widget's histogram, which needs a
  // real distribution, not just avg/P50. Computed from the same deduped
  // per-session samples as sessionWallAvgMs/P50 above, before they're
  // discarded at rollup.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  sessionWallDurationBuckets: { key: string; count: number }[];

  // Cold-connection (fresh DNS lookup + fresh TCP handshake, vitals.tcp > 0)
  // DNS/TCP timing — see navReusedCountries below for the "reused, no ms
  // stored" counterpart. Percentiles here are overall across all cold
  // samples this period, not per-country; navColdCountries is a separate
  // count-only breakdown for spotting which geography is generating cold
  // connections, not a per-country percentile split.
  @Column({ type: 'numeric', nullable: true })
  dnsColdP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  dnsColdP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  dnsColdP99: string | null;

  @Column({ type: 'numeric', nullable: true })
  tcpColdP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  tcpColdP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  tcpColdP99: string | null;

  @Column({ type: 'int', default: 0 })
  navColdCount: number;

  // Load-phase milestones for the "navigation timing" waterfall widget —
  // wall-clock-from-navigation-start timestamps (nav.domContentLoadedEventEnd/
  // nav.loadEventEnd), cold-connection samples only (see navColdKey), P50
  // only since this is a single-number-per-phase display, not a percentile
  // spread like lcp/ttfb.
  @Column({ type: 'numeric', nullable: true })
  domContentLoadedColdP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  loadCompleteColdP50: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  navColdCountries: { key: string; count: number }[];

  // Reused connections never have their ms stored (near-zero by definition,
  // not diagnostically interesting) — just a country-tagged counter of how
  // often it happened.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  navReusedCountries: { key: string; count: number }[];

  // LCP split by navigation type — 'reload'/'back_forward' (and
  // 'prerender', folded in as effectively pre-warmed) count as cached;
  // 'navigate' counts as cold. Additive alongside the blended lcpP50/P75/P99
  // above, which stays unchanged so nothing reading it today regresses.
  @Column({ type: 'numeric', nullable: true })
  lcpColdP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  lcpColdP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  lcpColdP99: string | null;

  @Column({ type: 'int', default: 0 })
  lcpColdCount: number;

  @Column({ type: 'numeric', nullable: true })
  lcpCachedP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  lcpCachedP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  lcpCachedP99: string | null;

  @Column({ type: 'int', default: 0 })
  lcpCachedCount: number;

  // Real per-sample TTFB HIT/MISS — sourced client-side, not from Cloudflare's
  // API (edgeTimeToFirstByteMs there turned out to require a Cloudflare Pro
  // plan; see edgelog-metric.entity.ts, which never got real ms data for
  // this because of that). A Transform Rule mirrors cf-cache-status into a
  // Server-Timing entry the embed script reads off nav.serverTiming and
  // tags onto its own already-accurate ttfb sample (vitals.ttfbCache).
  // Additive alongside the blended ttfbP50/P75/P99 above, same reasoning as
  // the LCP split. Statuses other than a clean hit/miss (dynamic, expired,
  // stale, bypass, ...) aren't counted in either bucket.
  @Column({ type: 'numeric', nullable: true })
  ttfbHitP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  ttfbHitP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  ttfbHitP99: string | null;

  @Column({ type: 'int', default: 0 })
  ttfbHitCount: number;

  @Column({ type: 'numeric', nullable: true })
  ttfbMissP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  ttfbMissP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  ttfbMissP99: string | null;

  @Column({ type: 'int', default: 0 })
  ttfbMissCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
