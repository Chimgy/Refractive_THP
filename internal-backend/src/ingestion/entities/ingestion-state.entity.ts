import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// One row per pull job ('usage-events-pull', 'rum-vitals-pull'). Watermark
// is the exclusive upper bound already consumed — a run reads
// [lastPulledAt, cutoff) from customerDB, then advances lastPulledAt to
// cutoff only after a successful write (plan §"Key decisions" item 9:
// cutoff is always floored to the start of the current hour, never `now()`,
// so a still-filling hour is never partially consumed).
@Entity('ingestion_state')
export class IngestionState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  jobName: string;

  @Column({ type: 'timestamptz' })
  lastPulledAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
