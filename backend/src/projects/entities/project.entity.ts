import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

// Gives the telemetry embed's `projectId` somewhere to actually belong to
// (external_data.md §5.1) — `id` (uuid) is what ends up in `data-project-id`
// on a third-party site's <script> tag. Slug is unique per company, not
// globally, since two different companies each embedding on their own site
// may reasonably both want e.g. "landing-page".
@Entity('projects')
@Index(['companyId', 'slug'], { unique: true })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  name: string;

  @Column()
  slug: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
