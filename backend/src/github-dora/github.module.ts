import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubCommit } from './entities/github-commit.entity';
import { GithubRepoLink } from './entities/github-repo-link.entity';
import { GithubCommitService } from './github-commit.service';
import { GithubJwtService } from './github-jwt.service';
import { GithubInstallationTokenService } from './github-installation-token.service';
import { GithubRepoLinkService } from './github-repo-link.service';
import { GithubRestClientService } from './github-rest-client.service';
import { GithubWebhookController } from './github-webhook.controller';

@Module({
    imports: [TypeOrmModule.forFeature([GithubRepoLink, GithubCommit])],
    controllers: [GithubWebhookController],
    providers: [GithubJwtService, GithubInstallationTokenService, GithubRestClientService, GithubRepoLinkService, GithubCommitService],
    exports: [GithubRestClientService, GithubRepoLinkService, GithubCommitService],
})
export class GithubModule {}
