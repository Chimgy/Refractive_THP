import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type VitalsMetricName = 'lcp' | 'fcp' | 'ttfb' | 'inp' | 'cls';
export type VitalsDimension =
  'overall' | 'device' | 'browser' | 'connection' | 'route' | 'country';

// One row per closed hour x metric x (dimension, value) — segmented
// independently per dimension (e.g. dimension='device', value='mobile'),
// NOT a full cross-product of device x browser x geo (plan §"Key decisions"
// item 4: p50/p75/p95 in a 'device' row are pooled across all
// browsers/geos, not sliced by them — a named, explicit deferral, not a
// silent gap). Populated by rum-vitals-pull.job.ts via `percentile_cont`
// computed directly against customerDB's rum_events at pull time (plan item
// 3) — only these small aggregate rows cross the wire, never raw samples.
@Entity('vitals_metrics')
@Index(['periodStart', 'metric', 'dimension', 'value'], { unique: true })
@Index(['metric', 'periodStart'])
export class VitalsMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'varchar' })
  metric: VitalsMetricName;

  @Column({ type: 'varchar' })
  dimension: VitalsDimension;

  // The segment value within `dimension`, e.g. 'mobile' for
  // dimension='device'; literally 'overall' when dimension='overall'.
  @Column({ type: 'varchar' })
  value: string;

  @Column({ type: 'numeric', nullable: true })
  p50: string | null;

  @Column({ type: 'numeric', nullable: true })
  p75: string | null;

  @Column({ type: 'numeric', nullable: true })
  p95: string | null;

  @Column({ type: 'int', default: 0 })
  sampleCount: number;

  @Column({ type: 'int', default: 0 })
  jsErrorCount: number;

  @Column({ type: 'int', default: 0 })
  resourceErrorCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
