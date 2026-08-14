import { InjectQueue } from '@nestjs/bullmq';
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
import type { Queue } from 'bullmq';
import type { Request } from 'express';
import { getClientCountry } from './client-geo.util';
import { getClientIp } from './client-ip.util';
import { getRequestOrigin } from './client-origin.util';
import {
  TELEMETRY_INGEST_QUEUE,
  TelemetryIngestJobData,
} from './telemetry-ingest.queue';
import { THP_ANALYTICS_SCRIPT } from './telemetry-script';
import { TelemetryOriginGuardService } from './telemetry-origin-guard.service';
import { TelemetryRateLimitService } from './telemetry-rate-limit.service';

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
    @InjectQueue(TELEMETRY_INGEST_QUEUE)
    private readonly queue: Queue<TelemetryIngestJobData>,
    private readonly rateLimit: TelemetryRateLimitService,
    private readonly originGuard: TelemetryOriginGuardService,
  ) {}

  @Get('THP_analytics.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  getScript(): string {
    return THP_ANALYTICS_SCRIPT;
  }

  // Validates and enqueues only — the actual six-way write fan-out
  // (snapshots/events/counters/uniques/errors/country) happens off the
  // request path in TelemetryIngestProcessor (external_data.md roadmap
  // item 5). Always 204 regardless of outcome: sendBeacon never checks the
  // response and the fetch fallback swallows errors, so there's no
  // legitimate visitor-facing use for a different status code here —
  // rejections are logged server-side instead.
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
    const ip = getClientIp(req);

    // Cheapest check first — a single Redis INCR, no DB round trip — so an
    // abusive caller gets capped before it costs a Postgres lookup too.
    if (!(await this.rateLimit.allow(projectId ?? 'unknown', ip))) {
      this.logger.warn(
        `Telemetry rate limit exceeded (projectId=${projectId ?? 'unknown'}, ip=${ip})`,
      );
      return;
    }

    // Fails closed (external_data.md roadmap item 6): no projectId, an
    // unregistered one, or a registered project whose allowedOrigins
    // doesn't include this request's origin all get dropped the same way —
    // silently, from the caller's perspective, same as every other outcome
    // of this endpoint.
    const origin = getRequestOrigin(req);
    if (!projectId || !(await this.originGuard.isAllowed(projectId, origin))) {
      this.logger.warn(
        `Telemetry request rejected: unregistered project or disallowed origin (projectId=${projectId ?? 'none'}, origin=${origin ?? 'none'})`,
      );
      return;
    }

    const jobData: TelemetryIngestJobData = {
      payload,
      projectId,
      userAgent,
      ip,
      country: getClientCountry(req),
    };
    await this.queue.add('ingest', jobData);
  }
}
