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
// `periodSeconds` is stored rather than assumed, so a later change to the
// rollup cadence doesn't silently reinterpret historical rows as covering
// the wrong window.
//
// Breakdown fields (topPages/taggedClicks/countries/scrollDepth/utmSources/
// eventTypeCounts) are jsonb arrays of `{key, count}` — same reasoning as
// telemetry_events.data used to be: these evolve as the script adds new
// event types, and forcing a migration per new breakdown isn't worth it.
@Entity('telemetry_metrics')
@Index(['projectId', 'periodStart'], { unique: true })
export class TelemetryMetric {
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

  @Column({ type: 'numeric', nullable: true })
  lcpP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  lcpP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  ttfbP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  ttfbP75: string | null;

  @Column({ type: 'numeric', nullable: true })
  dwellAvgMs: string | null;

  @Column({ type: 'numeric', nullable: true })
  dwellP50: string | null;

  @Column({ type: 'numeric', nullable: true })
  sessionDurationAvgMs: string | null;

  @Column({ type: 'numeric', nullable: true })
  sessionDurationP50: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
