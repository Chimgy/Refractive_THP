import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Sentry-style error grouping: one row per unique (projectId, fingerprint),
// bumped via `INSERT ... ON CONFLICT ... DO UPDATE SET count = count + N`
// (see TelemetryErrorsService — TypeORM's declarative `upsert()` can only
// overwrite columns with new values, it can't express an increment against
// the existing row, so this table is written with a raw query instead).
// Fingerprint is SHA256(message:file:line:col), deliberately not the full
// stack trace — minified builds shift chunk hashes between deploys, which
// would split one real bug into many fingerprints instead of grouping it.
//
// `projectId` nullable, same as the other telemetry tables — note a NULL
// never equals another NULL under a unique index, so errors with an unknown
// project don't dedupe against each other; each becomes its own row.
@Entity('telemetry_error_fingerprints')
@Index(['projectId', 'fingerprint'], { unique: true })
export class TelemetryErrorFingerprint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  projectId: string | null;

  @Column({ type: 'varchar' })
  fingerprint: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', nullable: true })
  file: string | null;

  @Column({ type: 'int', nullable: true })
  line: number | null;

  @Column({ type: 'int', nullable: true })
  col: number | null;

  @Column({ type: 'int', default: 1 })
  count: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  firstSeenAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSeenAt: Date;
}
