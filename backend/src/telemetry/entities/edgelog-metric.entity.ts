import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Edge-provider-sourced metrics — one row per (project, 5-minute period,
// source). Deliberately a separate table from SdkTelemetryMetric, not more
// columns bolted onto it: SdkTelemetryMetric's jsonb breakdown columns
// (topPages, taggedClicks, etc.) are NOT NULL with no default, so a writer
// that only ever knows edge-provider fields could never safely INSERT a new
// row there, only UPDATE one TelemetryRollupProcessor already created —
// meaning a period with real zone traffic but zero *embed-script* activity
// would silently lose its edge data. This table has no such coupling: every
// column here is nullable/defaulted, so TelemetryCloudflarePullProcessor
// (and, later, an equivalent CloudFront puller) can freely upsert on its own
// (projectId, periodStart, source) key regardless of what the SDK rollup did
// or didn't write that period.
//
// `source` is the extension point — 'cloudflare' today, 'cloudfront' later
// reuses this same table rather than forking a new one. GitHub DORA metrics
// (external_data.md section 1's third data domain) get their own table
// entirely when that's built — unrelated data shape, not a `source` value
// here.
@Entity('edgelog_metrics')
@Index(['projectId', 'periodStart', 'source'], { unique: true })
export class EdgeLogMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar' })
  source: string;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'int' })
  periodSeconds: number;

  // Cloudflare's edge-measured TTFB-equivalent (GraphQL Analytics API's
  // httpRequestsAdaptiveGroups, avg { edgeTimeToFirstByteMs }), grouped by
  // real cacheStatus — the actual "hit ms and miss ms" this table exists
  // for. Counts are the request counts backing each average, needed for
  // weighted cross-period folding (TelemetryMetricsQueryService).
  @Column({ type: 'numeric', nullable: true })
  cacheHitAvgMs: string | null;

  @Column({ type: 'int', default: 0 })
  cacheHitCount: number;

  @Column({ type: 'numeric', nullable: true })
  cacheMissAvgMs: string | null;

  @Column({ type: 'int', default: 0 })
  cacheMissCount: number;

  // True origin-only latency, decoupled from edge/cache time
  // (originResponseDurationMs) — a number this pipeline has never had at
  // all before this table.
  @Column({ type: 'numeric', nullable: true })
  originResponseAvgMs: string | null;

  // Which Cloudflare edge datacenter (coloCode) served this project's
  // traffic this period — the authoritative version of
  // SdkTelemetryMetric.navColdCountries' "which geo is generating cold
  // connections" signal, sourced directly from Cloudflare rather than
  // inferred from CF-IPCountry.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  edgeLocations: { key: string; count: number }[];

  @CreateDateColumn()
  createdAt: Date;
}
