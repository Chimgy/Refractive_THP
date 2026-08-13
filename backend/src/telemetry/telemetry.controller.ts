import { Controller, Get, Header, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { THP_ANALYTICS_SCRIPT } from './telemetry-script';
import { TelemetrySnapshotsService } from './telemetry-snapshots.service';

// Deliberately outside the tenant/internal silos and the global `api`
// prefix (see main.ts) — this is the one surface embedded on *other*
// people's websites, so its two routes need stable, unprefixed paths:
// GET /THP_analytics.js and POST /telemetry.
@Controller()
export class TelemetryController {
  constructor(private readonly snapshots: TelemetrySnapshotsService) {}

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

    await this.snapshots.capture(payload, {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }
}
