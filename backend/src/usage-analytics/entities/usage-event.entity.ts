import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';

// Behavioral event types this endpoint accepts — kept as a plain string
// column (not a Postgres enum) since new event types are expected to be
// added incrementally as frontend call sites grow (see plan §"Explicitly
// deferred"), same reasoning telemetry_metrics' jsonb breakdown columns
// used to avoid a migration per new dimension.
export type UsageEventType =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'feature_used'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_abandoned'
  | 'error_encountered';

// First-party product-analytics event: an authenticated tenant user doing
// something inside Refractive_THP itself, not a third-party site's visitor
// (that's raw_telemetry_snapshots/telemetry_metrics — a completely separate
// pipeline). companyId/userId are always server-derived from the JWT
// (CurrentUser), never client-supplied — see UsageEventsController.
@Entity('usage_events')
@Index(['companyId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['eventType', 'createdAt'])
export class UsageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  eventType: UsageEventType;

  // Specific feature/workflow/error identifier within eventType, e.g.
  // 'project.create', 'dashboard.tab_view', an error code.
  @Column({ type: 'varchar' })
  eventName: string;

  @Column({ type: 'varchar', nullable: true })
  route: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  // Same header/util as the public telemetry pipeline
  // (telemetry/client-geo.util.ts) — not duplicated, reused directly since
  // both live in this same app.
  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
