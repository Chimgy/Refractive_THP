import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// The entire DAU/WAU/MAU correctness mechanism (plan §"Key decisions" item
// 2): one row per (day, companyId, userId), UNIQUE — so DAU/WAU/MAU are
// COUNT(DISTINCT userId) over a rolling window at QUERY time
// (metrics-query.service.ts), never a pre-summed number. Summing daily
// actives to get a weekly figure would double-count anyone active on 2+
// days; this table makes that impossible by construction.
//
// Repeated hourly pulls touching the same still-open UTC day are free
// no-ops via INSERT ... ON CONFLICT DO NOTHING against the unique index
// below (usage-events-pull.job.ts) — the day isn't "closed" until its 24th
// hourly pull, so re-touching it is expected, not a bug.
@Entity('daily_active_user_log')
@Index(['day', 'companyId', 'userId'], { unique: true })
@Index(['companyId', 'day'])
@Index(['userId', 'day'])
export class DailyActiveUserLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // TypeORM maps a `date` column to a plain 'YYYY-MM-DD' string, not a Date
  // — deliberate, avoids timezone-shift surprises when comparing against the
  // UTC day boundary this value is truncated from.
  @Column({ type: 'date' })
  day: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  userId: string;

  // Diagnostic only — earliest createdAt seen for this user on this day.
  // Not used by any DAU/WAU/MAU calculation.
  @Column({ type: 'timestamptz' })
  firstEventAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
