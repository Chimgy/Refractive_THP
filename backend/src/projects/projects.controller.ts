import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LiveAuthGuard } from '../auth/guards/live-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateGithubRepoLinkDto } from '../github-dora/dto/create-github-repo-link.dto';
import { GithubCommitService } from '../github-dora/github-commit.service';
import { GithubRepoLinkService } from '../github-dora/github-repo-link.service';
import { GithubRestClientService } from '../github-dora/github-rest-client.service';
import { CloudflareZoneLinkService } from '../telemetry/cloudflare-zone-link.service';
import { TelemetryErrorsService } from '../telemetry/telemetry-errors.service';
import { TelemetryMetricsQueryService } from '../telemetry/telemetry-metrics-query.service';
import { TelemetrySnapshotsService } from '../telemetry/telemetry-snapshots.service';
import { TelemetryUniquesService } from '../telemetry/telemetry-uniques.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { LinkCloudflareZoneDto } from './dto/link-cloudflare-zone.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard, LiveAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly uniquesService: TelemetryUniquesService,
    private readonly metricsQueryService: TelemetryMetricsQueryService,
    private readonly cloudflareZoneLinkService: CloudflareZoneLinkService,
    private readonly errorsService: TelemetryErrorsService,
    private readonly snapshotsService: TelemetrySnapshotsService,
    private readonly githubRepoLinkService: GithubRepoLinkService,
    private readonly githubRestClientService: GithubRestClientService,
    private readonly githubCommitService: GithubCommitService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(
      user.companyId,
      dto.name,
      dto.allowedOrigins,
    );
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findByCompany(user.companyId);
  }

  @Get(':projectId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.findByIdForCompany(projectId, user.companyId);
  }

  // `projectId` here is an opaque string, same as ingest — it isn't checked
  // against `Project` rows -- NEED TO UPDATE TO CURRENT
  @Get(':projectId/telemetry/uniques')
  async uniqueVisitors(
    @Param('projectId') projectId: string,
    @Query('days') daysParam?: string,
  ) {
    const days = Math.min(30, Math.max(1, Number(daysParam) || 7));
    const uniqueVisitors = await this.uniquesService.countRecent(
      projectId,
      days,
    );
    return { projectId, days, uniqueVisitors };
  }

  // findByIdForCompany 404s a projectId that exists but belongs
  // to a different company
  @Get(':projectId/telemetry/summary')
  async telemetrySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query('days') daysParam?: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    const days = Math.min(30, Math.max(1, Number(daysParam) || 7));
    return this.metricsQueryService.getSummary(projectId, days);
  }

  @Get(':projectId/telemetry/errors')
  async listErrors(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    const page = Math.max(1, Number(pageParam) || 1);
    const limit = Math.min(50, Math.max(1, Number(limitParam) || 20));
    return this.errorsService.list(projectId, { page, limit });
  }

  // Raw snapshots correlated to a single error fingerprint, via the
  // errorFingerprints array column populated at ingest
  @Get(':projectId/telemetry/errors/:fingerprint/snapshots')
  async errorSnapshots(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('fingerprint') fingerprint: string,
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    const page = Math.max(1, Number(pageParam) || 1);
    const limit = Math.min(50, Math.max(1, Number(limitParam) || 20));
    return this.snapshotsService.findByFingerprint(projectId, fingerprint, {
      page,
      limit,
    });
  }

  // The token is never returned here.. CloudflareZoneLinkService only ever hands the
  // decrypted token to TelemetryCloudflarePullProcessor.
  @Post(':projectId/cloudflare-link')
  async linkCloudflareZone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: LinkCloudflareZoneDto,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    await this.cloudflareZoneLinkService.link(
      projectId,
      dto.zoneId,
      dto.apiToken,
    );
    return { projectId, zoneId: dto.zoneId, linked: true };
  }

  @Delete(':projectId/cloudflare-link')
  @HttpCode(204)
  async unlinkCloudflareZone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    await this.cloudflareZoneLinkService.unlink(projectId);
  }

  // Config-presence check for the dashboard's "Connections" widget
  @Get(':projectId/cloudflare-link')
  async cloudflareLinkStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    return this.cloudflareZoneLinkService.getStatus(projectId);
  }

  @Post(':projectId/github-link')
  async linkGithubRepo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateGithubRepoLinkDto,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    await this.githubRepoLinkService.link(
      projectId,
      dto.owner,
      dto.repo,
      dto.installationId,
    );
    return { projectId, owner: dto.owner, repo: dto.repo, linked: true };
  }

  @Delete(':projectId/github-link')
  @HttpCode(204)
  async unlinkGithubRepo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    await this.githubRepoLinkService.unlink(projectId);
  }

  @Get(':projectId/github-link')
  async githubLinkStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    return this.githubRepoLinkService.getStatus(projectId);
  }

  // proof of concept data pull - not the periodic DORA aggregation yet
  @Get(':projectId/github-link/metrics')
  async githubBasicMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    const link = await this.githubRepoLinkService.findByProjectId(projectId);
    if (!link) {
      throw new NotFoundException('No GitHub repo linked to this project.');
    }
    const [repo, contributors, pulls] = await Promise.all([
      this.githubRestClientService.getRepo(
        link.installationId,
        link.owner,
        link.repo,
      ),
      this.githubRestClientService.getContributors(
        link.installationId,
        link.owner,
        link.repo,
      ),
      this.githubRestClientService.getPulls(
        link.installationId,
        link.owner,
        link.repo,
      ),
    ]);
    return { repo, contributors, pulls };
  }

  @Get(':projectId/github-link/commits/by-author')
  async githubCommitsByAuthor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    return this.githubCommitService.getByAuthor(projectId);
  }

  @Get(':projectId/github-link/commits/by-day')
  async githubCommitsByDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    return this.githubCommitService.getByDay(projectId);
  }

  // Live pull, not webhook-sourced — there's no useful "branch list changed"
  // event to key off, and GitHub's branches endpoint is always accurate.
  @Get(':projectId/github-link/branches')
  async githubBranches(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    const link = await this.githubRepoLinkService.findByProjectId(projectId);
    if (!link) {
      throw new NotFoundException('No GitHub repo linked to this project.');
    }
    return this.githubRestClientService.getBranches(
      link.installationId,
      link.owner,
      link.repo,
    );
  }
}
