import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  PERIOD_TTL_SECONDS,
  clicksKey,
  countriesKey,
  dwellKey,
  eventTypesKey,
  lcpKey,
  pagesKey,
  periodKey,
  scrollKey,
  sessionDurationKey,
  sessionsKey,
  ttfbKey,
  utmSourceKey,
} from './telemetry-aggregation-keys.util';

// Replaces the old daily-bucketed TelemetryCountersService — writes go into
// short-lived 5-minute-period keys instead, consumed and discarded by
// TelemetryRollupProcessor rather than read directly. Bucketed by
// processing time, not each event's own client-reported `ts`: the worker
// processes jobs promptly (concurrency 10) so the two are close enough that
// per-event precision isn't worth the complexity of possibly splitting one
// batch's events across two period buckets.
@Injectable()
export class TelemetryAggregationService {
  constructor(private readonly redis: RedisService) {}

  async recordBatch(
    payload: Record<string, unknown>,
    meta: { projectId: string },
  ): Promise<void> {
    const rawEvents = Array.isArray(payload.events) ? payload.events : [];
    if (rawEvents.length === 0) return;

    const period = periodKey(new Date());
    const sessionId =
      typeof payload.sessionId === 'string' ? payload.sessionId : null;

    // Same-key/field increments within one batch tallied locally first —
    // one HINCRBY by N, not N round trips (same pattern the old counters
    // service used).
    const hashBumps = new Map<string, Map<string, number>>();
    const bump = (key: string, field: string) => {
      const fields = hashBumps.get(key) ?? new Map<string, number>();
      fields.set(field, (fields.get(field) ?? 0) + 1);
      hashBumps.set(key, fields);
    };
    const listPushes: { key: string; value: string }[] = [];
    let sessionsStarted = 0;

    for (const event of rawEvents) {
      if (typeof event !== 'object' || event === null) continue;
      const e = event as Record<string, unknown>;
      const type = typeof e.type === 'string' ? e.type : 'unknown';

      bump(eventTypesKey(meta.projectId, period), type);

      if (type === 'pageview' && typeof e.url === 'string') {
        bump(pagesKey(meta.projectId, period), e.url);
      } else if (type === 'click' && typeof e.tag === 'string') {
        bump(clicksKey(meta.projectId, period), e.tag);
      } else if (type === 'scroll_depth' && typeof e.depth === 'number') {
        bump(scrollKey(meta.projectId, period), String(e.depth));
      } else if (type === 'session_start') {
        sessionsStarted += 1;
        if (typeof e.utm_source === 'string') {
          bump(utmSourceKey(meta.projectId, period), e.utm_source);
        }
      } else if (
        type === 'session_end' &&
        typeof e.durationMs === 'number' &&
        sessionId
      ) {
        // Raw fires, duplicates and all (external_data.md section 1) — max
        // per session is taken at rollup, not here.
        listPushes.push({
          key: sessionDurationKey(meta.projectId, period),
          value: `${sessionId}:${e.durationMs}`,
        });
      } else if (type === 'vitals') {
        if (typeof e.lcp === 'number') {
          listPushes.push({
            key: lcpKey(meta.projectId, period),
            value: String(e.lcp),
          });
        }
        if (typeof e.ttfb === 'number') {
          listPushes.push({
            key: ttfbKey(meta.projectId, period),
            value: String(e.ttfb),
          });
        }
      } else if (type === 'dwell' && typeof e.ms === 'number') {
        listPushes.push({
          key: dwellKey(meta.projectId, period),
          value: String(e.ms),
        });
      }
    }

    const writes: Promise<void>[] = [];
    for (const [key, fields] of hashBumps) {
      for (const [field, count] of fields) {
        writes.push(
          this.redis.hincrbyWithExpire(key, field, count, PERIOD_TTL_SECONDS),
        );
      }
    }
    for (const { key, value } of listPushes) {
      writes.push(this.redis.rpushWithExpire(key, value, PERIOD_TTL_SECONDS));
    }
    if (sessionsStarted > 0) {
      writes.push(
        this.redis.incrbyWithExpire(
          sessionsKey(meta.projectId, period),
          sessionsStarted,
          PERIOD_TTL_SECONDS,
        ),
      );
    }

    await Promise.all(writes);
  }

  // Request-level, not per-event — CF-IPCountry describes the connection
  // the whole batch arrived on (same reasoning as TelemetryUniquesService).
  async recordCountry(meta: {
    projectId: string;
    country: string | null;
  }): Promise<void> {
    if (!meta.country) return;
    const period = periodKey(new Date());
    await this.redis.hincrbyWithExpire(
      countriesKey(meta.projectId, period),
      meta.country,
      1,
      PERIOD_TTL_SECONDS,
    );
  }
}
