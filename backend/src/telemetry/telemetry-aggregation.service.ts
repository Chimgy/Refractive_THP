import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  PERIOD_TTL_SECONDS,
  clicksKey,
  countriesKey,
  devicesKey,
  dwellKey,
  eventTypesKey,
  lcpCachedKey,
  lcpColdKey,
  lcpKey,
  localesKey,
  navColdKey,
  navReusedKey,
  pagesKey,
  periodKey,
  scrollKey,
  sessionDurationKey,
  sessionsKey,
  ttfbHitKey,
  ttfbKey,
  ttfbMissKey,
  utmSourceKey,
} from './telemetry-aggregation-keys.util';

// Matches the breakpoints MetricsPage.tsx documents for the "device mix"
// card — kept here rather than duplicated so the aggregation and the write-up
// can't silently drift apart.
function deviceCategory(viewportWidth: number): string {
  if (viewportWidth <= 768) return 'mobile';
  if (viewportWidth >= 1280) return 'desktop';
  return 'tablet';
}

// Sanity ceilings for client-reported durations — confirmed necessary
// against real data: a backgrounded browser tab left open for hours keeps
// re-firing session_end (durationMs = Date.now() - startedAt, never reset)
// and can report wildly inflated LCP (PerformanceObserver keeps updating
// until the page hides). One such sample was enough to drag a whole
// period's lcpP75/ttfbP75 into the millions of ms. Rejected outright rather
// than clamped to the ceiling — a fabricated-but-bounded number is still a
// fabrication; an abandoned tab isn't a real (or measurable) engaged
// session, so the honest move is to exclude the sample, not invent a
// plausible-looking replacement for it.
const MAX_LCP_MS = 60_000;
const MAX_TTFB_MS = 60_000;
const MAX_DWELL_SAMPLE_MS = 30 * 60_000;
const MAX_SESSION_DURATION_MS = 60 * 60_000;
// Same reasoning as MAX_TTFB_MS — a fresh DNS lookup or TCP handshake has no
// legitimate reason to take longer than this either.
const MAX_NAV_TIMING_MS = 60_000;

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
    meta: { projectId: string; country: string | null },
  ): Promise<void> {
    const rawEvents = Array.isArray(payload.events) ? payload.events : [];
    if (rawEvents.length === 0) return;

    const period = periodKey(new Date());
    const sessionId =
      typeof payload.sessionId === 'string' ? payload.sessionId : null;

    // Batch-level metadata (telemetry-script.ts sends it on every flush, not
    // per-event) — read once here rather than per-event below.
    const device =
      typeof payload.device === 'object' && payload.device !== null
        ? (payload.device as Record<string, unknown>)
        : null;
    const viewport = Array.isArray(device?.viewport) ? device.viewport : null;
    const viewportWidth =
      typeof viewport?.[0] === 'number' ? viewport[0] : null;
    const locale = typeof device?.lang === 'string' ? device.lang : null;

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
        // Once per session, same reasoning as utm_source above — a per-event
        // or per-flush bump would count one visitor dozens of times over a
        // long session instead of once.
        if (viewportWidth !== null) {
          bump(
            devicesKey(meta.projectId, period),
            deviceCategory(viewportWidth),
          );
        }
        if (locale) {
          bump(localesKey(meta.projectId, period), locale);
        }
      } else if (type === 'session_end' && sessionId) {
        // Prefer activeMs (cumulative dwell — excludes hidden/idle time,
        // see telemetry-script.ts) over raw wall-clock durationMs. This is
        // the actual fix for the abandoned-tab distortion, not just the
        // ceiling below: a backgrounded tab left open for hours reports
        // ~0 activeMs regardless of how long it sat open, so it no longer
        // needs rejecting in the first place. durationMs is a fallback only
        // for tabs still running a pre-activeMs copy of the script (cached
        // in the browser from before this shipped).
        const value =
          typeof e.activeMs === 'number'
            ? e.activeMs
            : typeof e.durationMs === 'number'
              ? e.durationMs
              : null;
        // Ceiling kept as defense-in-depth even for activeMs — cheap
        // insurance against clock weirdness or a future signal that isn't
        // as well-behaved as dwell turned out to be. Raw fires, duplicates
        // and all (external_data.md section 1) — max per session is taken
        // at rollup, not here.
        if (value !== null && value <= MAX_SESSION_DURATION_MS) {
          listPushes.push({
            key: sessionDurationKey(meta.projectId, period),
            value: `${sessionId}:${value}`,
          });
        }
      } else if (type === 'vitals') {
        if (typeof e.lcp === 'number' && e.lcp <= MAX_LCP_MS) {
          listPushes.push({
            key: lcpKey(meta.projectId, period),
            value: String(e.lcp),
          });
          // Additive split alongside the blended push above — see
          // lcpColdKey/lcpCachedKey's own comments for why this stays
          // separate from lcpKey rather than replacing it.
          if (e.lcpCache === 'cold') {
            listPushes.push({
              key: lcpColdKey(meta.projectId, period),
              value: String(e.lcp),
            });
          } else if (e.lcpCache === 'cached') {
            listPushes.push({
              key: lcpCachedKey(meta.projectId, period),
              value: String(e.lcp),
            });
          }
        }
        if (typeof e.ttfb === 'number' && e.ttfb <= MAX_TTFB_MS) {
          listPushes.push({
            key: ttfbKey(meta.projectId, period),
            value: String(e.ttfb),
          });
          // Additive split alongside the blended push above, same shape as
          // lcp/lcpCold/lcpCached — labels this exact sample with the real
          // cf-cache-status a Cloudflare Transform Rule mirrors into
          // Server-Timing (telemetry-script.ts). Anything other than a
          // clean hit/miss (dynamic, expired, stale, bypass, ...) is left
          // out of both buckets rather than mislabeled into one.
          const ttfbCache =
            typeof e.ttfbCache === 'string'
              ? e.ttfbCache.toLowerCase()
              : null;
          if (ttfbCache === 'hit') {
            listPushes.push({
              key: ttfbHitKey(meta.projectId, period),
              value: String(e.ttfb),
            });
          } else if (ttfbCache === 'miss') {
            listPushes.push({
              key: ttfbMissKey(meta.projectId, period),
              value: String(e.ttfb),
            });
          }
        }
        // Reused connections are just a country-tagged counter (no ms —
        // near-zero by definition, not diagnostically interesting). Cold
        // connections carry their actual dns/tcp ms, composite-encoded with
        // country same as sessionDurationKey encodes sessionId — one Redis
        // key per period, not one per country.
        if (
          typeof e.dns === 'number' &&
          typeof e.tcp === 'number' &&
          e.dns <= MAX_NAV_TIMING_MS &&
          e.tcp <= MAX_NAV_TIMING_MS
        ) {
          if (e.navReused === true) {
            bump(navReusedKey(meta.projectId, period), meta.country ?? 'unknown');
          } else if (e.navReused === false) {
            listPushes.push({
              key: navColdKey(meta.projectId, period),
              value: `${meta.country ?? 'unknown'}:${e.dns}:${e.tcp}`,
            });
          }
        }
      } else if (
        type === 'dwell' &&
        typeof e.ms === 'number' &&
        e.ms <= MAX_DWELL_SAMPLE_MS
      ) {
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
