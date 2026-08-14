# External Telemetry — System Spec

Full rundown of the telemetry pipeline (`project-plan.md section 6`) as it actually exists right now — not a spec written in advance. Supersedes every earlier version of this doc; if code and this doc disagree, trust the code and fix this doc.

---

## 1. What this is

One of three data domains in the portal (`project-plan.md section 1`): usage data from any project that embeds `THP_analytics.js`, funneled through a queue-backed ingest pipeline into a small set of pre-aggregated summary rows the dashboard reads. The other two domains (GitHub DORA metrics, AWS/Cloudflare infra polling) don't exist yet — this doc is telemetry only.

**Status:** backend pipeline is fully built and verified end-to-end (real events → Redis aggregation → 5-minute rollup → summary table). The dashboard still renders `mock.ts` — wiring it to read real data is the next piece of work, not yet started.

---

## 2. Pipeline

```
Browser (THP_analytics.js)
  │  batched, sendBeacon/fetch, text/plain body
  ▼
Ingest gate — TelemetryController (POST /telemetry)
  │  rate limit (Redis)  →  origin allowlist (Postgres)  →  enqueue, 204 immediately
  ▼
Queue — BullMQ "telemetry-ingest" (Redis-backed, concurrency 10)
  │  pure transport — not a data destination
  ▼
Write fan-out — TelemetryIngestProcessor
  ├─→ Postgres: raw_telemetry_snapshots (raw blob, partitioned by month)
  ├─→ Postgres: telemetry_error_fingerprints (deduped, count++)
  ├─→ Redis: unique-visitor HLL (daily bucket)
  └─→ Redis: period-bucketed aggregates — TelemetryAggregationService
          (pages, clicks, countries, scroll, utm_source, event_types,
           sessions, lcp, ttfb, dwell, session_duration)
  ▼
Metrics engine — TelemetryRollupProcessor, BullMQ "telemetry-rollup"
  │  every 5 min: reads the just-closed period's Redis keys for every
  │  project, computes real numbers (percentiles included, not just
  │  means), upserts one summary row, deletes the consumed keys
  ▼
Postgres: telemetry_metrics (one row per project × 5-min period)
  ▲
  │  dashboard reads ONLY this table — never Redis, never raw snapshots
  ▼
Dashboard (not built yet — currently 100% mock.ts)
```

A separate daily job (`TelemetryMaintenanceProcessor`, BullMQ `telemetry-maintenance`) keeps `raw_telemetry_snapshots`' monthly partitions rolling forward and drops expired ones.

### Why this shape

The original design normalized every event into its own Postgres row (`telemetry_events`). That's gone. Once pageviews/clicks/scroll are Redis counters, vitals/dwell/session-duration are Redis sample lists, and errors have their own fingerprint table, a per-event Postgres table has no remaining job — it was a needless middle ground between the raw blob (`raw_telemetry_snapshots`) and the summary table (`telemetry_metrics`), better served by either extreme. Dropping it also means the dashboard never runs an expensive query against raw data — it only ever reads pre-aggregated rows.

---

## 3. Ingest gate

`backend/src/telemetry/telemetry.controller.ts`. `POST /telemetry` and `GET /THP_analytics.js` are a **fourth silo**, alongside auth/tenant/internal — imported directly into `AppModule`, excluded from the global `api` prefix (`main.ts`), no JWT/`RolesGuard` (there's no session to authenticate; the only "identity" is the public, non-secret `projectId`). These URLs get baked into third-party HTML the moment a site embeds the script, so they need to be stable and root-level forever, independent of API versioning.

`main.ts` registers `express.text({ type: '*/*' })` scoped to `/telemetry` — body is always parsed as raw text regardless of declared content-type, then `JSON.parse`d manually in the controller (`{ raw: ... }` fallback if parsing fails, so malformed input is never silently dropped).

On every request, in order:

1. **Rate limit** — `telemetry-rate-limit.service.ts`. Redis fixed-window counter, 120 requests/min per (`projectId`, ip). `INCR` + `EXPIRE ... NX` (only sets expiry on the first hit in the window, so a sustained caller can't keep pushing the window out and never actually get capped). Checked first since it's one Redis round trip, no DB hit.
2. **Origin allowlist** — `telemetry-origin-guard.service.ts`. **Fails closed.** Checks the request's `Origin` header (falling back to `Referer`) against `Project.allowedOrigins`. Rejects if: no `projectId`, the `projectId` isn't a valid UUID shape (checked *before* querying — a non-UUID string sent straight to Postgres throws `invalid input syntax for type uuid`, an unhandled crash found and fixed during testing), the project doesn't exist, or its allowlist doesn't include this origin. All rejections look identical from the outside: silent 204, server-side `logger.warn` only.
3. **Enqueue** — anything that passes both gets pushed onto `telemetry-ingest` with `{ payload, projectId, userAgent, ip, country }` (ip/country/userAgent captured here since they're request-scoped headers — a queued job can't go back and re-read them later). Request returns 204 immediately regardless of what happens downstream.

**IP resolution:** `client-ip.util.ts` uses Express's own `req.ip`, resolved via `app.set('trust proxy', 1)` in `main.ts` — trusts exactly one hop (Cloudflare's edge, Tunnel or classic proxied DNS) to have appended the real client IP to `X-Forwarded-For`. Standard mechanism, not Cloudflare-specific — keeps working unmodified behind CloudFront+ALB later (bump the hop count to 2). Country still comes from the Cloudflare-specific `CF-IPCountry` header (`client-geo.util.ts`) since there's no generic equivalent — CloudFront's is `CloudFront-Viewer-Country`, a straight swap when that migration happens.

**Known gap, not yet fixed:** the origin-guard's Postgres lookup runs on every single request, uncached, on the hot path. Not literally a "Postgres will fall over" problem — it's an indexed PK lookup, Postgres handles tens of thousands of those per second — but it's inconsistent with how this codebase already solves the identical shape of problem for auth (JWT validation caches sessions in Redis specifically to avoid a DB hit per request). Worth adding a short-TTL cache (Redis or in-process LRU) in front of the project/origin lookup; low urgency at ~1 real project, but cheap to do and matches existing precedent.

---

## 4. Queue — `telemetry-ingest`

BullMQ, registered in `app.module.ts` on a **dedicated Redis connection** (`maxRetriesPerRequest: null` — required for BullMQ's blocking commands, which shouldn't be forced onto the general-purpose client used for counters/HLL/auth cache).

- **Concurrency: 10.** BullMQ workers default to concurrency 1 if unset — confirmed the hard way: a 125-request burst left 80 jobs sitting in `wait` with only one `active` at a time, pure self-inflicted serial latency for what's lightweight I/O. After the fix, a same-shaped 150-request burst drained to `0` in `wait`/`active` within the same second the burst finished.
- **Retry: 5 attempts, exponential backoff**, on any destination failure. A known, accepted trade-off: a retry re-runs *every* destination in the job, including ones that already succeeded, so a retry can duplicate a raw-snapshot row or double-count a Redis aggregate. Same category as `session_end`'s documented duplicate-tolerant design (below) — accepted because true per-destination retry would mean splitting this into several separate queues, not worth it without real failure data to justify it.
- **Job history bounded**: `removeOnComplete: { age: 3600 }`, `removeOnFail: { age: 24*3600 }` — same "don't accumulate forever" instinct as every Redis TTL in this system.

`TelemetryIngestProcessor` (`telemetry-ingest.processor.ts`) is the consumer. Per job, `Promise.allSettled` across four destinations, each logged individually on failure, job throws (triggering the retry above) if *any* destination failed:

1. `TelemetrySnapshotsService.capture()` → `raw_telemetry_snapshots`
2. `TelemetryAggregationService.recordBatch()` + `.recordCountry()` → Redis aggregates (section 5)
3. `TelemetryUniquesService.recordVisit()` → HLL
4. `TelemetryErrorsService.recordBatch()` → `telemetry_error_fingerprints`

---

## 5. Aggregation layer (Redis)

`telemetry-aggregation.service.ts` + `telemetry-aggregation-keys.util.ts`. Every event in a batch gets bucketed by **5-minute period** (`periodKey()` floors a timestamp to the nearest 5 minutes, returns it as an ISO string — doubles as both the Redis key suffix and a directly-parseable `periodStart` value for the summary row). Bucketed by *processing* time, not each event's own client-reported `ts` — the worker processes jobs promptly (concurrency 10), so the two are close enough that splitting one batch across two buckets isn't worth the complexity.

All keys are per-project, TTL 30 minutes (a 6x buffer over the 5-minute rollup cadence, so a delayed or retried rollup still finds the data).

| Redis structure | Key | Written on | Read as |
|---|---|---|---|
| Hash (HINCRBY) | `telemetry:agg:pages:{projectId}:{period}` | `pageview` | top pages this period |
| Hash | `telemetry:agg:clicks:{projectId}:{period}` | `click` | tagged clicks |
| Hash | `telemetry:agg:countries:{projectId}:{period}` | every request (via `CF-IPCountry`) | country breakdown |
| Hash | `telemetry:agg:scroll:{projectId}:{period}` | `scroll_depth` | milestone counts |
| Hash | `telemetry:agg:utm_source:{projectId}:{period}` | `session_start` (if `utm_source` present) | attribution breakdown |
| Hash | `telemetry:agg:event_types:{projectId}:{period}` | every event, unconditionally | total events/period |
| Scalar (INCRBY) | `telemetry:agg:sessions:{projectId}:{period}` | `session_start` | new sessions this period |
| List (RPUSH) | `telemetry:agg:lcp:{projectId}:{period}` | `vitals.lcp` | LCP p50/p75 |
| List | `telemetry:agg:ttfb:{projectId}:{period}` | `vitals.ttfb` | TTFB p50/p75 |
| List | `telemetry:agg:dwell:{projectId}:{period}` | `dwell.ms` | dwell avg + p50 |
| List | `telemetry:agg:session_duration:{projectId}:{period}` | `session_end.durationMs`, as `"{sessionId}:{durationMs}"` | session duration avg + p50 |

**Why lists, not sum/count, for LCP/TTFB/dwell/session-duration:** a sum+count pair can only ever reconstruct a *mean* — never a percentile, and Web Vitals thresholds (Google's Good/Needs-Improvement/Poor bands) are percentile-based, not mean-based, matching how the rest of this dashboard already reports metrics (dev tab: lead-time p50/p90; post-dev tab: latency p50/p99). Lists collect raw samples; the rollup computes a real nearest-rank percentile in JS from the full list, then discards it. Considered and rejected: Redis sorted sets (member-uniqueness is a footgun for repeated identical values) and a proper t-digest/sketch structure (real overhead for a volume this small — a 5-minute window's worth of samples per project).

**Session duration specifically** is stored as `"{sessionId}:{durationMs}"`, not a bare number — `session_end` fires on every tab-hide, not once per session (documented quirk below), so the rollup groups by `sessionId` and keeps only the max `durationMs` per session before computing stats *over sessions*, not over raw fires. Otherwise repeated fires (which climb from small to large) would skew the distribution toward the smaller early values.

**Deliberately not built this way:** a per-session Redis hash tracking `start_time`/`last_active` (considered, then dropped) — the client already computes and sends `durationMs` directly on `session_end`, so there's nothing to reconstruct server-side from timestamps. One less moving part for the same result.

---

## 6. Metrics engine — the rollup

`telemetry-rollup.processor.ts` + `telemetry-rollup.queue.ts`. BullMQ **Job Scheduler** (`queue.upsertJobScheduler(id, { every: 5min })`, registered once in `onModuleInit` — the older `{ repeat: {...} }` option on `.add()` doesn't exist in BullMQ v6, this project's installed version). A stable scheduler id makes registration idempotent across restarts (dev's watch-mode reload included) — re-registering updates the existing schedule instead of stacking duplicates.

Each tick:

1. Compute `previousPeriodKey(now)` — the period that just closed (not the current one, which is still being written to).
2. For every `Project` row, read that period's ~11 Redis keys (`HGETALL`/`GET`/`LRANGE`, all in parallel).
3. Compute: `pageViews` (sum of the pages hash), `sessions` (the scalar counter), top-20 breakdowns for pages/clicks/countries/scroll/utm/event-types (sorted desc, `{key, count}[]`), percentiles for LCP/TTFB (p50 + p75), dwell (avg + p50), session duration (deduped avg + p50, per above).
4. If there was **any** activity, `upsert` one row into `telemetry_metrics` keyed on `(projectId, periodStart)` — safe to re-run for the same period. If nothing happened, no row is written (missing period = zero, not a stored zero row).
5. `DEL` every key that was read, whether or not a row was written.

**Verified end-to-end** (2026-08-14): sent a batch covering every event type, confirmed all 10 Redis keys landed correctly, waited for the real first automatic tick, confirmed the resulting `telemetry_metrics` row matched exactly — `pageViews: 1`, `sessions: 1`, `lcpP50: 1800`, `ttfbP50: 220`, `dwellAvgMs: 14500`, `sessionDurationAvgMs: 22000`, correct `topPages`/`taggedClicks`/`utmSources`, and all consumed Redis keys gone afterward.

### `telemetry_metrics` table

`entities/telemetry-metric.entity.ts`. One row per `(projectId, periodStart)`, unique-indexed. `periodSeconds` stored explicitly (not assumed) so a future change to the rollup cadence doesn't silently reinterpret old rows as covering the wrong window. Breakdown columns (`topPages`, `taggedClicks`, `countries`, `scrollDepth`, `utmSources`, `eventTypeCounts`) are `jsonb` arrays of `{key, count}` — same reasoning `telemetry_events.data` used to have: these evolve as the script adds event types, and a migration per new breakdown isn't worth it. Percentile/average columns are `numeric` (nullable — absent, not zero, when a period had no samples for that metric), stored as strings per TypeORM's numeric-column convention (avoids float precision loss).

**The dashboard reads only this table.** Never Redis directly, never `raw_telemetry_snapshots`.

---

## 7. Raw snapshots — `raw_telemetry_snapshots`

`entities/raw-telemetry-snapshot.entity.ts`. The "in case we need to reprocess" escape hatch — one row per POST, raw JSON payload untouched. Natively partitioned by month:

```sql
CREATE TABLE raw_telemetry_snapshots (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  "projectId" character varying,
  payload jsonb NOT NULL,
  "userAgent" character varying,
  "receivedAt" timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id, "receivedAt")
) PARTITION BY RANGE ("receivedAt");
```

**Why raw SQL, not the entity decorator:** TypeORM's `synchronize` has no concept of declarative partitioning — it would either ignore the partitioning entirely or fight the manual DDL on every restart. The entity is declared `@Entity({ synchronize: false })`, so TypeORM still gives the app a typed repository for inserts, but never tries to manage this table's schema. All DDL (parent table, partitions, drops) lives in `telemetry-snapshot-partition.service.ts` and was run once by hand for the initial setup (same precedent as the original historical backfill — there's no migration tooling in this project yet).

**Note on the primary key:** Postgres requires a partitioned table's PK to include the partition key column, so it's `PRIMARY KEY (id, "receivedAt")`, not just `id`. `id` alone is still what every application-level lookup uses (still a UUID, still unique in practice) — the composite constraint is a Postgres requirement, not a data-model choice.

**Retention:** current + previous month kept; anything older is dropped wholesale (`DROP TABLE`, not `DELETE` — no per-row scan, no bloat, no vacuum overhead). `TelemetryMaintenanceProcessor` runs daily (`telemetry-maintenance.queue.ts`, its own BullMQ Job Scheduler) and:

1. Ensures the current + next month's partitions exist (`CREATE TABLE IF NOT EXISTS ... PARTITION OF ... FOR VALUES FROM ... TO ...` — Postgres has no default catch-all partition, so an insert with no matching partition just fails outright if this hasn't run ahead of time).
2. Drops the partition for `now - 2 months` (keeps current + previous month, matches "the past month" as the UI's raw-lookup retention window).

Partition names are deterministic (`raw_telemetry_snapshots_YYYY_MM`), so both operations are `IF EXISTS`/`IF NOT EXISTS` and idempotent — no catalog introspection needed.

**Migration note:** the old `telemetry_snapshots` (351 rows) and `telemetry_events` (493 rows, now fully retired) tables were migrated/dropped by hand on 2026-08-14 — snapshot rows copied into the new partitioned table, `telemetry_events` dropped outright since nothing reads it anymore.

---

## 8. Embed script — `backend/src/telemetry/telemetry-script.ts`

Served verbatim at `GET /THP_analytics.js`. Plain JS string, not a build artifact, ~2KB, IIFE.

- **Session id**: `sessionStorage` (`thp_sid`, `thp_start`), cookieless, rotates naturally per tab session.
- **`document.currentScript`**: reads `data-project-id` off its own `<script>` tag. Guarded — `currentScript` is null for `type="module"` embeds or anything not executing synchronously as a classic script; the IIFE returns early instead of throwing into the host page's console. Doesn't make module-script embeds *work*, just stops them from crashing.
- **UTM params**: captured once, at session start (`utm_source`/`utm_medium`/`utm_campaign`), stashed in `sessionStorage` — not re-parsed per pageview, so a second pageview with no query string doesn't silently drop attribution.
- **Batches events in memory.** Flushes via `navigator.sendBeacon` (body as `text/plain` — sidesteps CORS preflight entirely, since arbitrary third-party sites call this, not just the portal's own frontend), falls back to `fetch(..., { keepalive: true })`. Flush triggers: `visibilitychange → hidden`, `pagehide`, 5s interval safety net.
- **Events implemented**: `pageview` (+referrer), `session_start` (+UTM), `session_end` (+`durationMs`), `click` (delegated listener on `data-thp-track="..."`, catches clicks inside React islands with no hydration-timing issues), `scroll_depth` (25/50/75/100%, 500ms-debounced), `dwell` (real start/pause/resume state machine — pauses on tab-hidden *and* >30s of no mouse/key/scroll/click activity), `vitals` (LCP via `PerformanceObserver`, TTFB + nav timing via the Navigation Timing API), `error` (window `error` listener — expect `"Script error."` noise from cross-origin scripts without `crossorigin` set, a browser privacy limitation, not a capture bug).
- **Device context**: `{ viewport, ua, lang }` sent once per batch (not per event) — currently lands in `raw_telemetry_snapshots` only; nothing in the new Redis aggregation layer reads it yet (no dashboard need identified so far — the old design's `telemetry_events.data.device` fold-in is moot now that table's gone).
- **Not built**: INP (Interaction to Next Paint) — deliberately skipped, not deferred. Needs per-interaction event timing across the page's life plus a percentile, not just "time after first click"; a correct hand-rolled version isn't worth it here, and pulling in Google's `web-vitals` lib conflicts with the "~2KB hand-rolled" story. Revisit only if something downstream actually needs it.

**Known quirk, by design:** `session_end` fires on *every* tab-hide, not once per session — a session backgrounded/refocused repeatedly emits many `session_end` events with climbing `durationMs`. Handled at the aggregation layer (section 5) by grouping on `sessionId` and taking the max per session at rollup time — the write path never mutates anything after insert.

Currently embedded on the user's real live site (`ramonlyvpn.net`, Astro + React islands) via the shared layout, right before `</body>`.

---

## 9. Projects, origins, and the allowlist

`projects/entities/project.entity.ts`. Real entity, tenant-owned (`companyId` FK), `allowedOrigins: string[]` (`simple-array` column, comma-joined). `POST /api/tenant/projects` accepts an optional `allowedOrigins` array at creation (`CreateProjectDto`, validated as URLs, max 10).

**Empty `allowedOrigins` fails closed** — same as an unregistered `projectId` (section 3). No implicit "wide open until configured" fallback.

**Currently one real project**: `ramonlyvpn.net`, id `21d7392a-ca93-4886-802b-9cf360d29a80`, `allowedOrigins: ['https://ramonlyvpn.net']`, owned by the `c@c.com` account's company (reassigned there by hand — was originally created under a different test company before that). Created by one-off manual SQL insert (same precedent as the raw-snapshot migration).

**Outstanding action, not yet done:** the live embed on `ramonlyvpn.net` still sends the literal placeholder `data-project-id="abc123"` (straight from `project-plan.md`'s own example snippet — never a real UUID). Since the allowlist fails closed, every real request from the live site is currently being rejected (silent 204, logged server-side as `unregistered project or disallowed origin`). Needs the embed tag updated to the real UUID above before live data collection resumes.

---

## 10. Security / abuse controls

- **CORS**: `main.ts`'s `enableCors()` takes a per-request delegate returning `{}` (no headers at all) for `/telemetry` and `/THP_analytics.js`, so the global `credentials: true` config never touches them — avoids the spec-invalid combination of `Access-Control-Allow-Origin: *` alongside `Access-Control-Allow-Credentials: true`. The controller sets its own `Access-Control-Allow-Origin: *` — correct and safe here specifically because telemetry never sends credentials.
- **Swagger**: `TelemetryController` carries `@ApiExcludeController()` — it's public-by-design, has no request contract worth documenting, and doesn't belong mixed into the real `/api/*` OpenAPI doc.
- **Rate limiting + origin allowlist**: section 3.
- **`TELEMETRY_HASH_SECRET`**: real random value, threaded through `docker-compose.yml`'s `environment:` block explicitly (matching every other secret) rather than relying on the `.env` bind-mount alone — that pattern won't exist once this runs on Fargate with no mounted file, only injected env vars.
- **IP/geo trust**: never trusts anything client-supplied for security or geo purposes. `CF-Connecting-IP`/`X-Forwarded-For` and `CF-IPCountry` are trusted specifically because they're properties of the TCP connection Cloudflare's edge terminates, not something the client reports about itself. **Gap, not yet closed:** nothing enforces that the origin *can't* be reached except through that trusted hop (no firewall/Authenticated-Origin-Pulls equivalent documented for when this is public on a real ALB) — the header trust is only as good as that assumption holding.
- **Raw IP**: never persisted anywhere, in any table. Unique visitors use a two-stage salted hash (`dailySalt = SHA256(secret + date)`, `id = SHA256(ip + ua + dailySalt)`) fed into a Redis HLL (`telemetry-uniques.service.ts`) — same visitor collapses to one id within a day, rotates the next day, and the stored hash carries no structure linking a visitor across days even for someone holding both the hash and the secret.
- **Considered and rejected as premature**: batching raw-snapshot INSERTs into multi-row statements. The old design (one Postgres row per *event*) could plausibly have needed this at volume; the current design (one row per *request*, everything else in Redis) already writes far less to Postgres, and single-row pooled inserts comfortably handle low-thousands/sec. Revisit only with real sustained throughput numbers that show it's actually the bottleneck.

---

## 11. Known gaps

- **Zero test coverage.** The only `.spec.ts` file in the whole backend is `app.controller.spec.ts`. Deliberately deferred, not forgotten.
- **Origin-guard has no request-time cache** — Postgres hit on every request (section 3). Cheap fix, low urgency at current traffic, inconsistent with the existing auth-cache pattern.
- **CF-header/X-Forwarded-For trust has no network-level enforcement** (section 10).
- **Device context** (`{viewport, ua, lang}`) isn't fed into any dashboard-facing aggregate — only sits in `raw_telemetry_snapshots`. No dashboard requirement has needed it yet; add a Redis breakdown (same shape as country) if one shows up.
- **No formal migration tooling.** Every schema change outside `synchronize`'s reach (the partitioned table, the historical backfill, manual project rows) has been a one-off SQL command run by hand. Fine at this scale; would need a real migration story before a second person touches this DB.

---

## 12. Roadmap status

1. **done** — Salted IP hashing + HyperLogLog unique visitors.
2. **done** — Projects table.
3. **done** — Rewrite `THP_analytics.js` (section 8's full event list).
4. **done** — Error fingerprinting + dedup table.
5. **done** — Write-path decoupling (section 3, section 4 — queue + async fan-out).
6. **done** — Origin/referer allowlisting + rate limiting (section 3, section 9).
7. **essentially done** — Full metrics wishlist client-side capture. Only INP skipped, deliberately (section 8).
8. **done, redesigned** — Originally scoped as "row-count-capped rollup/prune." Actual shape ended up better: a real metrics engine (section 6) replacing per-event storage entirely, plus time-based partition drop (section 7) instead of row-count capping — simpler and doesn't need row-count thresholds guessed in advance.
9. **mostly done** — Audit cleanup (Swagger, CORS, secret provisioning, partial-failure handling, device-context fold-in from the old design). Remaining: test coverage.
10. **not started, next up** — Wire the dashboard to read from `telemetry_metrics`. `DashboardPage.tsx`'s Telemetry tab is still 100% `mock.ts`. This is the actual goal of the whole thread.
