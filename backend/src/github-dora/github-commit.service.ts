import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GithubCommit } from './entities/github-commit.entity';

export type CommitByAuthor = { author: string; count: number };
export type CommitByDay = { day: string; count: number };

@Injectable()
export class GithubCommitService {
  constructor(
    @InjectRepository(GithubCommit)
    private readonly commits: Repository<GithubCommit>,
  ) {}

  async recordPush(
    projectId: string,
    branch: string,
    commits: {
      sha: string;
      authorLogin: string | null;
      authorName: string;
      committedAt: Date;
    }[],
  ): Promise<void> {
    if (commits.length === 0) return;
    await this.commits
      .createQueryBuilder()
      .insert()
      .values(
        commits.map((c) => ({
          projectId,
          branch,
          sha: c.sha,
          authorLogin: c.authorLogin,
          authorName: c.authorName,
          committedAt: c.committedAt,
        })),
      )
      .orIgnore()
      .execute();
  }

  async getByAuthor(projectId: string): Promise<CommitByAuthor[]> {
    const rows = await this.commits.find({ where: { projectId } });
    const totals = new Map<string, number>();
    for (const row of rows) {
      const author = row.authorLogin ?? row.authorName;
      totals.set(author, (totals.get(author) ?? 0) + 1);
    }
    return Array.from(totals.entries())
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getByDay(projectId: string): Promise<CommitByDay[]> {
    const rows = await this.commits.find({ where: { projectId } });
    const totals = new Map<string, number>();
    for (const row of rows) {
      const day = row.committedAt.toISOString().slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + 1);
    }
    return Array.from(totals.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }
}
