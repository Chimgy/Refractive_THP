import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { queryCloudflareGraphQL } from './cloudflare-graphql.client';
import { CloudflareZoneLinkService } from './cloudflare-zone-link.service';
import { EdgeLogMetric } from './entities/edgelog-metric.entity';
import { PERIOD_MS, periodKey } from './telemetry-aggregation-keys.util';
import {
  TELEMETRY_CLOUDFLARE_PULL_JOB_ID,
  TELEMETRY_CLOUDFLARE_PULL_QUEUE,
} from './telemetry-cloudflare-pull.queue';

const SOURCE = 'cloudflare';

type HttpRequestsGroup = {
  count: number;
  sum: { originResponseDurationMs: number };
  dimensions: { cacheStatus: string; edgeResponseStatus: number };
};

type HttpRequestsQueryResult = {
  viewer: {
    zones: { httpRequestsAdaptiveGroups: HttpRequestsGroup[] }[];
  };
};

// coloCode and sum.edgeTimeToFirstByteMs were both dropped after confirming
// in production against a real zone that they're plan-gated — coloCode
// with an explicit "zone does not have access to the field 'colocode'"
// error, edgeTimeToFirstByteMs the same way with 'edgetimetofirstbytems'
// (both require Cloudflare Pro, $20/mo, verified against the zone's own
// error responses since the public docs don't document per-field plan
// gating anywhere fetchable). One inaccessible field fails the *entire*
// query, not just that column, which was silently zeroing out everything
// else too. edgeLocations is written as [] until there's a zone on a plan
// that actually exposes coloCode.
//
// Real per-request TTFB HIT/MISS ms now comes from a different source
// entirely — see sdk-telemetry-metric.entity.ts's ttfbHit*/ttfbMiss*
// columns: a Cloudflare Transform Rule mirrors cf-cache-status into a
// Server-Timing entry, which the embed script reads directly off
// nav.serverTiming and tags onto its own already-accurate client-measured
// ttfb sample (telemetry-script.ts). That's real, per-visitor, and free —
// this GraphQL pull no longer tries to reconstruct hit/miss ms itself; it
// only still contributes real per-status request counts and origin-only
// response time (originResponseDurationMs, confirmed NOT plan-gated),
// neither of which the embed script could ever produce.
const QUERY = `
  query($zoneTag: String!, $start: Time!, $end: Time!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequestsAdaptiveGroups(
          filter: { datetime_geq: $start, datetime_lt: $end, cacheStatus_in: ["hit", "miss"] }
          limit: 100
        ) {
          count
          sum { originResponseDurationMs }
          dimensions { cacheStatus edgeResponseStatus }
        }
      }
    }
  }
`;

const numOrNull = (n: number | null): string | null => n?.toString() ?? null;

// edgeResponseStatus isn't Cloudflare-plan-gated (unlike coloCode/
// edgeTimeToFirstByteMs, see this file's top comment), so status-class
// counts are real from day one. Bucketed to response class, not stored
// per-code — the dashboard only needs 2xx/3xx/4xx/5xx, not a 20-column
// breakdown per status.
function statusBucket(status: number): '2xx' | '3xx' | '4xx' | '5xx' | null {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return null;
}

// Pulls real per-status request counts and origin-only response time from
// Cloudflare's GraphQL Analytics API (httpRequestsAdaptiveGroups) into
// edgelog_metrics — zone-wide context Cloudflare's edge can see and the
// embed script structurally can't (it has no visibility into traffic that
// never ran the script, e.g. bots, or into origin-only latency). Real
// per-visitor TTFB HIT/MISS ms lives on sdk_telemetry_metrics instead (see
// this file's own top comment above the query) — not duplicated here.
@Processor(TELEMETRY_CLOUDFLARE_PULL_QUEUE)
export class TelemetryCloudflarePullProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(TelemetryCloudflarePullProcessor.name);

  constructor(
    @InjectQueue(TELEMETRY_CLOUDFLARE_PULL_QUEUE)
    private readonly queue: Queue,
    @InjectRepository(EdgeLogMetric)
    private readonly edgeLogs: Repository<EdgeLogMetric>,
    private readonly zoneLinks: CloudflareZoneLinkService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(TELEMETRY_CLOUDFLARE_PULL_JOB_ID, {
      every: PERIOD_MS,
    });
  }

  async process(_job: Job): Promise<void> {
    // Two cycles back (10 minutes), not the period that just closed — a
    // deliberate lag buffer, since Cloudflare's analytics ingestion isn't
    // guaranteed to have the just-closed window available yet. Same
    // "generous buffer" reasoning PERIOD_TTL_SECONDS uses elsewhere in this
    // pipeline for a different kind of lag.
    const period = periodKey(new Date(Date.now() - 2 * PERIOD_MS));
    const linkedZones = await this.zoneLinks.findAllLinked();

    await Promise.all(
      linkedZones.map((zone) =>
        this.pullZone(zone.projectId, zone.zoneId, zone.apiToken, period).catch(
          (err: unknown) => {
            this.logger.error(
              `Cloudflare pull failed for project=${zone.projectId} period=${period}: ${String(err)}`,
            );
          },
        ),
      ),
    );
  }

  private async pullZone(
    projectId: string,
    zoneId: string,
    apiToken: string,
    period: string,
  ): Promise<void> {
    const periodStartMs = new Date(period).getTime();
    const start = new Date(periodStartMs).toISOString();
    const end = new Date(periodStartMs + PERIOD_MS).toISOString();

    const data = await queryCloudflareGraphQL<HttpRequestsQueryResult>(
      apiToken,
      QUERY,
      { zoneTag: zoneId, start, end },
    );
    const groups = data.viewer.zones[0]?.httpRequestsAdaptiveGroups ?? [];
    if (groups.length === 0) return;

    let hitCount = 0;
    let missCount = 0;
    let originSum = 0;
    let originCount = 0;
    let status2xxCount = 0;
    let status3xxCount = 0;
    let status4xxCount = 0;
    let status5xxCount = 0;

    for (const group of groups) {
      if (group.dimensions.cacheStatus === 'hit') {
        hitCount += group.count;
      } else if (group.dimensions.cacheStatus === 'miss') {
        missCount += group.count;
      }
      originSum += group.sum.originResponseDurationMs;
      originCount += group.count;

      switch (statusBucket(group.dimensions.edgeResponseStatus)) {
        case '2xx':
          status2xxCount += group.count;
          break;
        case '3xx':
          status3xxCount += group.count;
          break;
        case '4xx':
          status4xxCount += group.count;
          break;
        case '5xx':
          status5xxCount += group.count;
          break;
      }
    }

    await this.edgeLogs.upsert(
      {
        projectId,
        source: SOURCE,
        periodStart: new Date(period),
        periodSeconds: PERIOD_MS / 1000,
        // No real ms value comes from GraphQL anymore — edgeTimeToFirstByteMs
        // is Pro-gated (see this file's top comment). These stay null;
        // ttfbHit*/ttfbMiss* on sdk_telemetry_metrics are the real numbers now.
        cacheHitAvgMs: null,
        cacheHitCount: hitCount,
        cacheMissAvgMs: null,
        cacheMissCount: missCount,
        originResponseAvgMs: numOrNull(
          originCount > 0 ? originSum / originCount : null,
        ),
        edgeLocations: [],
        status2xxCount,
        status3xxCount,
        status4xxCount,
        status5xxCount,
      },
      ['projectId', 'periodStart', 'source'],
    );
  }
}
