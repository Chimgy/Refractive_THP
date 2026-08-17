import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type KeyCount = { key: string; count: number };
export type WorkflowFunnelRow = {
  key: string;
  started: number;
  completed: number;
  abandoned: number;
};

// One row per UTC day, companyId null = platform-wide rollup row. Breakdown
// columns are jsonb arrays, same "evolves without a migration per new
// dimension" reasoning as telemetry_metrics' topPages/utmSources columns in
// the customer backend.
//
// NOTE: the real uniqueness constraint here is
// `UNIQUE NULLS NOT DISTINCT (periodStart, companyId)`, created via raw SQL
// in the InitialInternalSchema migration — TypeORM's @Index decorator has no
// NULLS NOT DISTINCT option, so it is deliberately NOT declared here to
// avoid generating a plain (and wrong) UNIQUE index on a future
// synchronize/generate pass. Postgres treats NULL <> NULL by default, so a
// plain UNIQUE(periodStart, companyId) would silently allow duplicate
// platform-wide (companyId IS NULL) rows for the same day.
@Entity('usage_metrics_daily')
export class UsageMetricsDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ type: 'int', default: 0 })
  newUsers: number;

  @Column({ type: 'int', default: 0 })
  returningUsers: number;

  @Column({ type: 'jsonb', default: [] })
  featureAdoption: KeyCount[];

  @Column({ type: 'jsonb', default: [] })
  workflowFunnel: WorkflowFunnelRow[];

  @Column({ type: 'jsonb', default: [] })
  topErrors: KeyCount[];

  // The only breakdown actually populated right now — counts per
  // UsageEventType ('login'/'logout'/'page_view' in practice today) seen in
  // usage_events, tallied while usage-events-pull.job.ts is already reading
  // the window for daily_active_user_log.
  @Column({ type: 'jsonb', default: [] })
  eventTypeCounts: KeyCount[];

  @Column({ type: 'int', default: 0 })
  totalEvents: number;

  @Column({ type: 'numeric', nullable: true })
  actionsPerUser: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
