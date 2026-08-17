import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// The "in case we need to reprocess" escape hatch — one row per batch
// POSTed to /telemetry, raw payload untouched, replacing telemetry_events
// as the durable record now that normalization writes straight to Redis
// aggregates instead (external_data.md roadmap item 8 redesign).
//
// Natively partitioned by month (`PARTITION BY RANGE ("receivedAt")`,
// raw SQL — TypeORM's `synchronize` doesn't understand declarative
// partitioning, hence `synchronize: false` below and the partition/child
// table DDL living in telemetry-snapshot-partition.service.ts instead of
// here). A partitioned table's primary key must include the partition key
// column, so the real DB constraint is `PRIMARY KEY (id, "receivedAt")` —
// `id` alone is still what every application-level lookup uses, since it's
// still a UUID and still unique in practice.
//
// Retention: current + previous month kept, older partitions dropped
// wholesale (`DROP TABLE`, not `DELETE`) — the "past month" cutoff the UI's
// raw-snapshot lookup is scoped to.
@Entity({ name: 'raw_telemetry_snapshots', synchronize: false })
export class RawTelemetrySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  projectId: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  // No IP column: geo/uniques need it hashed-before-persisted or not stored
  // raw at all — see visitor-hash.util.ts.
  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  // Correlation key back to telemetry_error_fingerprints — same sha256 hash
  // (telemetry-fingerprint.util.ts), one per distinct error event this
  // snapshot's payload contains. Null (not empty array) when the batch had
  // no error events, keeping the GIN index small.
  @Column({ type: 'text', array: true, nullable: true })
  errorFingerprints: string[] | null;

  @CreateDateColumn()
  receivedAt: Date;
}
