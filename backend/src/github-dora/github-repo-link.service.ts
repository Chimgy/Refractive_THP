import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GithubRepoLink } from './entities/github-repo-link.entity';

export type LinkedGithubRepo = {
  projectId: string;
  owner: string;
  repo: string;
  installationId: string;
};

@Injectable()
export class GithubRepoLinkService {
  constructor(
    @InjectRepository(GithubRepoLink)
    private readonly links: Repository<GithubRepoLink>,
  ) {}

  async link(
    projectId: string,
    owner: string,
    repo: string,
    installationId: string,
  ): Promise<void> {
    await this.links.upsert({ projectId, owner, repo, installationId }, [
      'projectId',
    ]);
  }

  async unlink(projectId: string): Promise<void> {
    await this.links.delete({ projectId });
  }

  async getStatus(
    projectId: string,
  ): Promise<{ linked: boolean; owner: string | null; repo: string | null }> {
    const link = await this.links.findOne({ where: { projectId } });
    return {
      linked: link !== null,
      owner: link?.owner ?? null,
      repo: link?.repo ?? null,
    };
  }

  async findByProjectId(projectId: string): Promise<LinkedGithubRepo | null> {
    const link = await this.links.findOne({ where: { projectId } });
    if (!link) return null;
    return {
      projectId: link.projectId,
      owner: link.owner,
      repo: link.repo,
      installationId: link.installationId,
    };
  }

  async findByOwnerRepo(
    owner: string,
    repo: string,
  ): Promise<LinkedGithubRepo | null> {
    const link = await this.links.findOne({ where: { owner, repo } });
    if (!link) return null;
    return {
      projectId: link.projectId,
      owner: link.owner,
      repo: link.repo,
      installationId: link.installationId,
    };
  }

  async findAllLinked(): Promise<LinkedGithubRepo[]> {
    const rows = await this.links.find();
    return rows.map((row) => ({
      projectId: row.projectId,
      owner: row.owner,
      repo: row.repo,
      installationId: row.installationId,
    }));
  }
}
