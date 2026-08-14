import {
  Body,
  Controller,
  Get,
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
import { TelemetryUniquesService } from '../telemetry/telemetry-uniques.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard, LiveAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly uniquesService: TelemetryUniquesService,
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
}
