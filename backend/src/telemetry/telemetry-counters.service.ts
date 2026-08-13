import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  clickCounterKey,
  countryCounterKey,
  pageViewCounterKey,
} from './telemetry-counter-keys.util';

// 8 days: enough buffer for a daily rollup job (not built yet) to read a
// day's counts before the key expires, without keeping counters forever —
// same unbounded-growth problem as an un-pruned Postgres table, just
// relocated to Redis if this weren't here.
const COUNTER_TTL_SECONDS = 8 * 24 * 60 * 60;

@Injectable()
export class TelemetryCountersService {
  constructor(private readonly redis: RedisService) {}

  // Hash per {project, day}, field = url/tag — new pages or tagged
  // elements are just new fields, never a schema change. Tallies
  // same-key/field increments within one batch locally first, so a visitor
  // clicking the same button three times in one flush is one HINCRBY by 3,
  // not three round trips.
  async recordBatch(
    payload: Record<string, unknown>,
    meta: { projectId: string | null },
  ) {
    const rawEvents = Array.isArray(payload.events) ? payload.events : [];
    if (rawEvents.length === 0) return;

    const project = meta.projectId ?? 'unknown';
    const today = new Date().toISOString().slice(0, 10);

    const tallies = new Map<string, Map<string, number>>();
    const bump = (key: string, field: string) => {
      const fields = tallies.get(key) ?? new Map<string, number>();
      fields.set(field, (fields.get(field) ?? 0) + 1);
      tallies.set(key, fields);
    };

    for (const event of rawEvents) {
      if (typeof event !== 'object' || event === null) continue;
      const e = event as Record<string, unknown>;
      if (e.type === 'pageview' && typeof e.url === 'string') {
        bump(pageViewCounterKey(project, today), e.url);
      } else if (e.type === 'click' && typeof e.tag === 'string') {
        bump(clickCounterKey(project, today), e.tag);
      }
    }
    if (tallies.size === 0) return;

    const writes: Promise<void>[] = [];
    for (const [key, fields] of tallies) {
      for (const [field, count] of fields) {
        writes.push(
          this.redis.hincrbyWithExpire(key, field, count, COUNTER_TTL_SECONDS),
        );
      }
    }
    await Promise.all(writes);
  }

  // Request-level, not per-event — CF-IPCountry describes the connection
  // the whole batch arrived on, not any individual event, so this is one
  // increment per POST (same reasoning as TelemetryUniquesService.recordVisit).
  async recordCountry(meta: {
    projectId: string | null;
    country: string | null;
  }): Promise<void> {
    if (!meta.country) return;

    const project = meta.projectId ?? 'unknown';
    const today = new Date().toISOString().slice(0, 10);
    await this.redis.hincrbyWithExpire(
      countryCounterKey(project, today),
      meta.country,
      1,
      COUNTER_TTL_SECONDS,
    );
  }
}
