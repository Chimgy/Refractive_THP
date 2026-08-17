import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  // against `Project` rows (unlike `get()` above) or the caller's company,
  // because the telemetry embed doesn't send a real Project id yet (that
  // link is roadmap step 6, origin/referer allowlisting, still pending).
  // Only requires auth, no company-ownership check, until that's wired up.
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

  // Unlike uniqueVisitors above, this reads the tenant-scoped
  // telemetry_metrics table directly (not an opaque Redis bucket), so it's
  // worth the ownership check — findByIdForCompany 404s a projectId that
  // exists but belongs to a different company, same guarantee `get()` above
  // already gives every other project-scoped read.
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

  // Ownership-checked the same way telemetrySummary is above.
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
  // errorFingerprints array column populated at ingest — see
  // telemetry-fingerprint.util.ts and telemetry-snapshots.service.ts.
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

  // Ownership-checked the same way telemetrySummary is above, before
  // touching anything Cloudflare-related. The token is never returned here
  // or anywhere else — CloudflareZoneLinkService only ever hands the
  // decrypted token to TelemetryCloudflarePullProcessor's own outbound
  // calls.
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

  // Config-presence check for the dashboard's "Connections" widget — not a
  // live health probe against Cloudflare's API (see getStatus's own
  // comment). Never returns the token.
  @Get(':projectId/cloudflare-link')
  async cloudflareLinkStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findByIdForCompany(projectId, user.companyId);
    return this.cloudflareZoneLinkService.getStatus(projectId);
  }
}
