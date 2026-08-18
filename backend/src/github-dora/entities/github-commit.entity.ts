import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('github_commits')
@Index(['projectId', 'sha'], { unique: true })
export class GithubCommit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar' })
  sha: string;

  @Column({ type: 'varchar', nullable: true })
  authorLogin: string | null;

  @Column({ type: 'varchar' })
  authorName: string;

  @Column({ type: 'varchar' })
  branch: string;

  @Column({ type: 'timestamptz' })
  committedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
