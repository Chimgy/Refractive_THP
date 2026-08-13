import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Prototype capture table for the THP_analytics.js embed — one row per
// batch POSTed to /telemetry, raw payload untouched. Exists to observe the
// real shape of client-sent data before it's worth designing the actual
// `telemetry_events` schema from project-plan.md §7.
@Entity('telemetry_snapshots')
export class TelemetrySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  projectId: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  // No IP column: geo/uniques need it hashed-before-persisted (salted
  // daily rotation, not built yet) or not stored raw at all.
  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  receivedAt: Date;
}
