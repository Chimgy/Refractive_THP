import { Controller, ForbiddenException, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { GithubCommitService } from './github-commit.service';
import { GithubRepoLinkService } from './github-repo-link.service';
import { verifyGithubWebhookSignature } from './github-webhook-signature.util';
import type { GithubPushEventPayload } from './types/github-api.types';

@Controller('github')
export class GithubWebhookController {
  private readonly logger = new Logger(GithubWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    configService: ConfigService,
    private readonly repoLinks: GithubRepoLinkService,
    private readonly commits: GithubCommitService,
  ) {
    const secret = configService.get<string>('GITHUB_APP_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('GITHUB_APP_WEBHOOK_SECRET must be set.');
    }
    this.webhookSecret = secret;
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
  ) {
    const rawBody = req.body as Buffer;
    if (!verifyGithubWebhookSignature(this.webhookSecret, rawBody, signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    if (event === 'ping') return { ok: true };
    if (event !== 'push') return { ok: true };

    const payload = JSON.parse(rawBody.toString('utf8')) as GithubPushEventPayload;
    if (payload.deleted) return { ok: true };

    const [owner, repo] = payload.repository.full_name.split('/');
    const link = await this.repoLinks.findByOwnerRepo(owner, repo);
    if (!link) {
      this.logger.warn(`Push webhook for unlinked repo ${payload.repository.full_name}`);
      return { ok: true };
    }

    const branch = payload.ref.replace('refs/heads/', '');
    await this.commits.recordPush(
      link.projectId,
      branch,
      payload.commits.map((c) => ({
        sha: c.id,
        authorLogin: c.author.username ?? null,
        authorName: c.author.name,
        committedAt: new Date(c.timestamp),
      })),
    );

    return { ok: true };
  }
}
