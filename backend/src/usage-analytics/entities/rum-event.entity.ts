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

export type RumMetricType =
  'lcp' | 'fcp' | 'ttfb' | 'inp' | 'cls' | 'js_error' | 'resource_error';

// Real-user-monitoring sample from Refractive_THP's OWN frontend (self
// monitoring, via the `web-vitals` library) — distinct from the third-party
// embed pipeline (telemetry/*), which measures tenants' end-users, not this
// product's own users. companyId/userId nullable: vitals can report before
// auth has resolved (e.g. on the login page itself).
@Entity('rum_events')
@Index(['metric', 'createdAt'])
@Index(['route', 'metric', 'createdAt'])
export class RumEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'companyId' })
  company: Company | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar' })
  route: string;

  @Column({ type: 'varchar' })
  metric: RumMetricType;

  // Null for js_error/resource_error rows — there's no numeric value to
  // percentile for those, only a count (see vitals_metrics.jsErrorCount /
  // .resourceErrorCount on the internal-backend side).
  @Column({ type: 'numeric', nullable: true })
  value: string | null;

  @Column({ type: 'varchar', nullable: true })
  deviceType: 'mobile' | 'tablet' | 'desktop' | null;

  @Column({ type: 'varchar', nullable: true })
  browser: string | null;

  @Column({ type: 'varchar', nullable: true })
  connectionType: string | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
