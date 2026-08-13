import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// The normalized log — one row per event, exploded from a
// telemetry_snapshots batch at ingest time. `eventType` stays a plain
// varchar (not a Postgres enum) so new event types from the script (perf
// vitals, scroll depth, errors, ...) never need a migration to add.
// `session_end` fires once per tab-hide, not once per session — this table
// keeps every occurrence; collapsing to the session's true duration
// (MAX(durationMs) per sessionId) is a read-time concern, not a write-time
// one, so history here is never mutated after insert.
@Entity('telemetry_events')
export class TelemetryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  projectId: string | null;

  @Column({ type: 'varchar' })
  sessionId: string;

  @Column({ type: 'varchar' })
  eventType: string;

  @Column({ type: 'varchar', nullable: true })
  url: string | null;

  // The event's own client-reported timestamp (from `ts` in the payload) —
  // distinct from `ingestedAt`, which is when the server actually received
  // the batch. Batched/delayed flushes mean these can differ.
  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  // Whatever's left after {type, url, ts} — referrer, tag, durationMs,
  // sessionStart, and whatever future event types add.
  @Column({ type: 'jsonb' })
  data: Record<string, unknown>;

  @CreateDateColumn()
  ingestedAt: Date;
}
