import { Controller, Get, Header, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { getClientCountry } from './client-geo.util';
import { getClientIp } from './client-ip.util';
import { THP_ANALYTICS_SCRIPT } from './telemetry-script';
import { TelemetryCountersService } from './telemetry-counters.service';
import { TelemetryErrorsService } from './telemetry-errors.service';
import { TelemetryEventsService } from './telemetry-events.service';
import { TelemetrySnapshotsService } from './telemetry-snapshots.service';
import { TelemetryUniquesService } from './telemetry-uniques.service';

// Deliberately outside the tenant/internal silos and the global `api`
// prefix (see main.ts) — this is the one surface embedded on *other*
// people's websites, so its two routes need stable, unprefixed paths:
// GET /THP_analytics.js and POST /telemetry.
@Controller()
export class TelemetryController {
  constructor(
    private readonly snapshots: TelemetrySnapshotsService,
    private readonly events: TelemetryEventsService,
    private readonly counters: TelemetryCountersService,
    private readonly uniques: TelemetryUniquesService,
    private readonly errors: TelemetryErrorsService,
  ) {}

  @Get('THP_analytics.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  getScript(): string {
    return THP_ANALYTICS_SCRIPT;
  }

  @Post('telemetry')
  @HttpCode(204)
  @Header('Access-Control-Allow-Origin', '*')
  async ingest(@Req() req: Request): Promise<void> {
    const raw = req.body as unknown;
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { raw };
      }
    }
    const payload: Record<string, unknown> =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { raw: parsed };
    const projectId =
      typeof payload.projectId === 'string' ? payload.projectId || null : null;
    const userAgent = req.get('user-agent') ?? null;

    await Promise.all([
      this.snapshots.capture(payload, { projectId, userAgent }),
      this.events.recordBatch(payload, { projectId }),
      this.counters.recordBatch(payload, { projectId }),
      this.uniques.recordVisit({
        projectId,
        ip: getClientIp(req),
        userAgent,
      }),
      this.errors.recordBatch(payload, { projectId }),
      this.counters.recordCountry({
        projectId,
        country: getClientCountry(req),
      }),
    ]);
  }
}
