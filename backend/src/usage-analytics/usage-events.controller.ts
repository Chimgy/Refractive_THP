import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LiveAuthGuard } from '../auth/guards/live-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { getClientCountry } from '../telemetry/client-geo.util';
import { CreateUsageEventsDto } from './dto/create-usage-events.dto';
import { UsageEventsService } from './usage-events.service';

// Authenticated first-party event capture — not to be confused with
// POST /telemetry (public, unauthenticated, third-party embed traffic).
// Same guard stack every other tenant-scoped controller uses.
@Controller('usage-events')
@UseGuards(JwtAuthGuard, RolesGuard, LiveAuthGuard)
export class UsageEventsController {
  constructor(private readonly usageEventsService: UsageEventsService) {}

  @Post()
  @HttpCode(204)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUsageEventsDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.usageEventsService.recordBatch(
      user.companyId,
      user.userId,
      getClientCountry(req),
      dto.events,
    );
  }
}
