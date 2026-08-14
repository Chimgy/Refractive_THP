import {
  Controller,
  Get,
  Header,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
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
// Excluded from Swagger: no auth guard, no request contract to document —
// it's not part of the `/api/*` surface Swagger is meant to describe, and
// leaving it in mixed undocumented routes into the real API contract.
@ApiExcludeController()
@Controller()
export class TelemetryController {
  private readonly logger = new Logger(TelemetryController.name);

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

    // allSettled, not all: one destination erroring (e.g. a Redis hiccup)
    // must not stop the others from landing, and must never surface as a
    // 500 — sendBeacon doesn't check responses and the fetch fallback
    // swallows errors, so a non-204 here is invisible to real visitors
    // anyway. Each failure is logged individually so it's not silently
    // lost; true partial-failure handling (retries, a queue) is the
    // roadmap's write-path decoupling item, not this fix.
    const destinations: [string, Promise<void>][] = [
      ['snapshots', this.snapshots.capture(payload, { projectId, userAgent })],
      ['events', this.events.recordBatch(payload, { projectId })],
      ['counters', this.counters.recordBatch(payload, { projectId })],
      [
        'uniques',
        this.uniques.recordVisit({
          projectId,
          ip: getClientIp(req),
          userAgent,
        }),
      ],
      ['errors', this.errors.recordBatch(payload, { projectId })],
      [
        'country',
        this.counters.recordCountry({
          projectId,
          country: getClientCountry(req),
        }),
      ],
    ];

    const results = await Promise.allSettled(destinations.map(([, p]) => p));
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Telemetry write failed for destination "${destinations[i][0]}" (projectId=${projectId ?? 'unknown'}): ${String(result.reason)}`,
        );
      }
    });
  }
}
