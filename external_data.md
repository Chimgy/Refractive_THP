# External Telemetry — Working Notes

`project-plan.md` was written upfront, before any of this existed. This doc is different: it's a running record of the telemetry pipeline (`project-plan.md §6`) as it's actually being built — a lot of the shape of it (event dedup behavior, the counters, the tunnel setup, the privacy calls) was worked out iteratively, not pre-planned. Read this as "what's actually true right now and why," not a spec written in advance.

---

## 1. What exists right now

### The embed script — `backend/src/telemetry/telemetry-script.ts`

Served verbatim at `GET /THP_analytics.js`. Plain JS string, not a build artifact — ~2KB.

- IIFE. Reads `data-project-id` off its own `<script>` tag via `document.currentScript`.
- Cookieless session id: `sessionStorage` (`thp_sid`, `thp_start`), rotates naturally per tab session (clears on tab close).
- Event types implemented so far: `pageview` (+`referrer`), `session_start` (+`sessionStart` ts), `session_end` (+`durationMs`), `click` (+`tag`, from `data-thp-track="..."` elements, via document-level delegated listener — catches clicks inside React islands on the Astro site too, no hydration timing issues).
- Batches events in memory. Flushes via `navigator.sendBeacon` (body sent as `text/plain` deliberately — this is what avoids a CORS preflight, since arbitrary third-party sites call this, not just our own frontend), falls back to `fetch(..., { keepalive: true })`.
- Flush triggers: `visibilitychange → hidden`, `pagehide`, and a 5s interval safety net.
- **Known quirk, by design, not a bug:** `session_end` fires on *every* tab-hide, not once per session — a session backgrounded/refocused repeatedly emits many `session_end` events with climbing `durationMs`. Verified against real data: one real session produced 16 raw `session_end` fires collapsing correctly to one true 696s duration via `MAX(durationMs) GROUP BY sessionId`. **This dedup happens at read/query time, never at write time** — the event log stays an honest, append-only record; nothing is mutated after insert.

Currently embedded on the user's real live site (`ramonlyvpn.net`, Astro + React islands) via the shared layout, right before `</body>`.

### Ingest — `backend/src/telemetry/`

`POST /telemetry` and `GET /THP_analytics.js` are a **fourth silo**, alongside auth/tenant/internal — imported directly into `AppModule`, not routed through `RouterModule`, and excluded from the global `api` prefix in `main.ts` (`setGlobalPrefix('api', { exclude: [...] })`). Reason: these URLs get baked into third-party HTML the moment a site embeds the script — they need to be stable and root-level forever, independent of whatever API versioning the rest of the app does. No JWT, no `RolesGuard` — there's no session to authenticate; the only "identity" on the request is the public, non-secret `projectId`.

`main.ts` also registers `express.text({ type: '*/*' })` scoped to `/telemetry` — the body is always parsed as raw text regardless of declared content-type, then `JSON.parse`d manually in the controller (with a `{ raw: ... }` fallback if parsing fails, so malformed input is never silently dropped).

Every `POST /telemetry` fans out to **four destinations in parallel** (`Promise.all` in `telemetry.controller.ts`):

1. **`telemetry_snapshots`** (`entities/telemetry-snapshot.entity.ts`) — raw batch capture, one row per POST, `payload` jsonb untouched. Exists purely for observability ("what does the raw shape actually look like"). No `ip` column — see privacy decisions below.
2. **`telemetry_events`** (`entities/telemetry-event.entity.ts`) — normalized, **one row per event**, exploded from the batch inline at ingest (no queue/job — see decisions below). Real columns: `projectId`, `sessionId`, `eventType`, `url`, `occurredAt` (the event's own client-reported `ts`, distinct from `ingestedAt` = server receipt time). Everything else (`referrer`/`tag`/`durationMs`/`sessionStart`/future fields) lives in a `data` jsonb column. `eventType` is a plain varchar, deliberately not a Postgres enum — new event types (vitals, scroll, errors, UTM) will get added to the script over time and shouldn't need a migration each time.
3. **Redis counters** (`telemetry-counters.service.ts`) — `HINCRBY telemetry:pages:{projectId}:{date} {url} 1` and `HINCRBY telemetry:clicks:{projectId}:{date} {tag} 1`. Same-key/field increments within one batch are tallied locally first (one `HINCRBY` by N, not N round trips). Keys self-expire after 8 days via a pipelined `hincrby`+`expire` (`RedisService.hincrbyWithExpire`), so they don't accumulate forever even with no rollup job.
4. **Unique-visitor HLL** (`telemetry-uniques.service.ts`, `visitor-hash.util.ts`, `client-ip.util.ts`) — **now built** (was §5 roadmap item #2, done ahead of schedule). `getClientIp` reads `CF-Connecting-IP` (Cloudflare-set from the real TCP connection, not client-controllable) — deliberately no `X-Forwarded-For` fallback, since that header's value/order is client-controllable unless Express `trust proxy` strips untrusted hops, which it isn't configured to. `hashVisitor` is a two-stage keyed hash: `dailySalt = SHA256(secret + date)`, then `id = SHA256(ip + userAgent + dailySalt)` — same visitor collapses to one id within a day (what `PFADD` needs), rotates the next day, and critically the *stored* hash carries no structure that links a visitor across days even for someone holding both the hash and the secret, unless they also independently have that day's raw IP+UA (which is never persisted anywhere — see decisions below). One `PFADD` per POST, not per event, since IP/UA are request-level. `PFADD`+`expire` pipelined via `RedisService.pfaddWithExpire`, same 8-day TTL pattern as the other counters.

### Dev tunnel — `docker-compose.yml` `cloudflared` service

The embed needs a public URL to reach the local dev backend — a real client's live site can't reach `localhost`. Using a **named Cloudflare Tunnel**, not ngrok:

- **ngrok was tried first and doesn't work for this.** Its free tier serves its own browser-warning interstitial (`ERR_NGROK_6024`) on every request unless a `ngrok-skip-browser-warning` header is sent — and a bare `<script src>` tag cannot attach custom headers. Not a config problem, a hard architectural blocker.
- Cloudflare Tunnel has no interstitial at all. Config: `CLOUDFLARE_TUNNEL_TOKEN` in root `.env` (gitignored; `.env.example` documents the shape). Hostname routing (which subdomain points at `backend:3000`) is configured in the Cloudflare Zero Trust dashboard → Public Hostname, not in compose.
- Live at `https://analytics.ramonlyvpn.net` → `cloudflared` container → `backend:3000` over the compose network. Origin service protocol is `http`, deliberately — that hop never leaves the Docker network, TLS already terminates at Cloudflare's edge, and the Nest app doesn't listen for TLS at all (`main.ts` has no `httpsOptions`), so setting `https` there would just break the connection, not add security.
- **This is dev-only infra.** No real client ever routes through it — once there's an actual deployed backend (per `project-plan.md §3`, ALB/CloudFront → Fargate), the embed just points straight at the real domain and the tunnel setup becomes irrelevant.

---

## 2. Decisions worth remembering (the "why", not just the "what")

- **Client-supplied data is never trusted for anything security- or geo-relevant.** Anything in the POST body is free to fabricate (devtools, a five-line curl script). IP-derived geo (`CF-IPCountry`, once built) is trustworthy-*er* specifically because it's a property of the TCP connection Cloudflare's edge terminates, not something the client reports about itself — costly to fake vs. free to fake.
- **Raw IP was removed from `telemetry_snapshots` entirely**, not just left unused — collecting it "for later" while the hashing/salting isn't built yet was judged worse than not collecting it at all. Don't re-add raw IP storage anywhere without the salt-then-hash step happening in the same unit of work.
- **Normalization (`telemetry_events`) is synchronous/inline, not queued** — there's no job/queue infra in this stack yet, and the batch is fully available at request time, so a decoupled worker would add lag for no current benefit. This is explicitly provisional: write-path decoupling (queue) is a known next step once there's real traffic to size batch/flush intervals against — sizing it now would be guessing.
- **HyperLogLog uniques and the salted-IP-hash feature were one unit of work, not two** (now built — see §1 item 4). HLL (`PFADD`/`PFCOUNT`, native in Redis, no need to hand-implement the bucket math) needs an opaque per-visitor identifier to add — the salted hash *is* that identifier.
- **Row-count-capped rollup/pruning is deferred, deliberately** — a real, agreed-on idea (cap detailed rows per project rather than pure time-based retention, so one high-traffic project can't balloon shared storage), but there's no real load yet to validate cap thresholds against.
- **Origin/Referer allowlisting is blocked on the Projects table** — there's nowhere to store "which domain is project `abc123` allowed to post from" without it.

---

## 3. Known gaps / loose ends (found during audit, not yet fixed)

The routing-level separation (telemetry as a "fourth silo," excluded from `/api`) is real and confirmed working end-to-end. Two *other* app-wide concerns weren't given the same treatment and still leak the tenant/internal-oriented config into telemetry:

- **Swagger leakage** — confirmed via `GET /api/docs-json`: `/THP_analytics.js` and `/telemetry` both appear in the OpenAPI doc, undocumented (no `@ApiOperation`/tags), mixed into the same document as the real `/api/*` contract. `SwaggerModule.createDocument()` scans the whole app by default; nobody told it to exclude `TelemetryController`.
- **CORS header conflict** — confirmed via curl: telemetry responses carry both `Access-Control-Allow-Origin: *` (the controller's manual per-route override, needed since telemetry accepts arbitrary origins) *and* `Access-Control-Allow-Credentials: true` (leaking from the global `app.enableCors({ credentials: true })` built for the tenant/internal surface). That combination is spec-invalid — browsers reject `Allow-Origin: *` alongside `Allow-Credentials: true` for credentialed requests. Currently harmless only because the script never sends `credentials: 'include'`. Real fix: telemetry shouldn't be touched by `enableCors()` at all, since it already sets its own header and never uses credentials.

Other things patched together to get the proof of concept working, not yet addressed:

- **`TELEMETRY_HASH_SECRET` isn't actually set anywhere** — not in `backend/.env`, not in `.env.example`, not in `docker-compose.yml`. `TelemetryUniquesService` is silently running on the hardcoded fallback `'dev-secret-change-me'` right now. Harmless at current scale/test data, but it means the "secret" isn't actually secret yet.
- **Zero test coverage for any of this.** The only `.spec.ts` file in the whole backend is `app.controller.spec.ts` — nothing for the telemetry controller, its four services, or the hash util, despite this being the largest surface area added this session.
- **No partial-failure handling in the four-way fan-out.** `Promise.all([snapshots, events, counters, uniques])` has no transaction wrapping it — if one write fails (e.g. a Redis hiccup), the others may have already landed, and the client gets a bare 500 with no retry. Invisible to real visitors (`sendBeacon` doesn't check responses, the `fetch` fallback swallows errors), but it's "best-effort by omission," not a deliberate design choice.
- **The historical backfill (12 snapshot batches → 49 `telemetry_events` rows) was a one-off manual SQL command**, run directly against the dev DB, not saved as a script/migration anywhere. If the entity shape changes again, there's no record of the exact transform beyond conversation history — which is part of why this doc exists.

---

## 4. Data captured so far

- ~14 original test batches (manual browsing on `ramonlyvpn.net`) backfilled into `telemetry_events` → 49 events, plus live traffic continuing to land.
- Event types actually observed in production data: `pageview`, `session_start`, `session_end`. `click` is implemented but hasn't fired yet — no `data-thp-track` element exists on the live site yet.

---

## 5. Full metrics wishlist (verbatim target list, for when the script gets rewritten)

**Privacy, Geography & Visitor Metrics:**
- Coarse Geolocation (Country/Region) via `CF-IPCountry` header — still not built, and unlike the line below, doesn't need the hash/salt step at all (it's a coarse aggregate, not an identity derivation)
- Privacy-preserving unique visitors: `SHA256(IP + UA + daily-rotating-salt)`, server-side only, never persist raw IP — **done, see §1 item 4**

**Core Web Vitals & Web Performance:**
- LCP (Largest Contentful Paint, target <2.5s)
- INP (Interaction to Next Paint, target <200ms) — flagged as genuinely hard to hand-roll correctly (needs tracking every interaction's event timing across the page's life + a percentile, not just "time after first click"); decision needed: simplified approximation vs. pulling in Google's `web-vitals` lib (conflicts with the "~2KB hand-rolled" story) vs. deferring
- TTFB (Time to First Byte)
- Navigation Load Timing (DNS, TCP, DOM load)

**Engagement & User Behavior:**
- Active Dwell Time, AFK-filtered (pauses after tab hidden or >30s inactive) — closes the "avg time per page" gap in `topPages`; needs a real per-pageview timer state machine (start/pause/resume/close-on-next-pageview-or-unload), not a reuse of the existing per-session timer
- Scroll Depth Milestones (25/50/75/100%)
- Top Pages Visited — already covered via `pageview.url`
- Tagged Element Clicks — already implemented

**Attribution & Environment:**
- UTM params (`utm_source`/`utm_medium`/`utm_campaign`) — capture once at session start/landing pageview, not re-parsed per pageview (a second pageview with no query string would otherwise silently drop attribution)
- HTTP Referrer — already implemented
- JS Client Errors (message/file/line) — expect a lot of `"Script error."` noise from cross-origin scripts without `crossorigin`/CORS set up; that's a known browser limitation, not a bug in the capture
- Device Context (viewport, UA, language) — already implemented

---

## 6. Roadmap (as agreed, this session)

1.**done** ~~Salted IP hashing + HyperLogLog unique visitors~~ — **done**, ahead of schedule (see §1 item 4).
2. **done** **Projects table** — real entity, tenant-owned, gives `projectId` somewhere to actually belong to. Also unblocks origin/referer allowlisting below, which currently has nowhere to store "which domain is project `abc123` allowed to post from."
3.**done**  **Rewrite `THP_analytics.js`** to add the outstanding metrics from §5.
4.**done**  **Error fingerprinting + dedup table** — Postgres `INSERT ... ON CONFLICT (project_id, fingerprint) DO UPDATE SET count = count + 1` pattern (matches how Sentry groups errors). Fingerprint on `message + file + line(+col)`, deliberately *not* full stack traces — those get noisy across minified builds since chunk hashes shift between deploys, splitting one real bug into multiple fingerprints.

**Stretch, after all of the above:**

5. Write-path decoupling — queue instead of the current synchronous four-way write per request (see §2).
6. Origin/Referer allowlisting + rate limiting on `/telemetry` (blocked on #2). Right now the endpoint is fully open to the public internet with zero abuse protection.
7. Remainder of §5's metrics: Core Web Vitals, Active Dwell Time, `CF-IPCountry` (if it can be trusted — it's Cloudflare-specific; disappears if this ever moves off Cloudflare-fronted infra, though CloudFront has an equivalent header and is already the planned prod front-end per `project-plan.md §3`).
8. **Row-count-capped rollup/prune** — cap detailed rows per project rather than pure time-based retention, so one high-traffic project can't balloon shared storage; pre-aggregate into a summary row before pruning rather than just deleting (matches the existing `dev_metrics_snapshots`/`infra_metrics_snapshots` pattern in `project-plan.md §7`). Deliberately last — there's no real load yet to validate cap thresholds against, and guessing at the right number now is worse than waiting for a project that actually needs it.
9. **Clean up §3's audit findings** — Swagger exclusion for the telemetry controller, stop telemetry responses from going through the global `enableCors()`, set a real `TELEMETRY_HASH_SECRET`, add test coverage, decide on partial-failure handling for the four-way fan-out.
10. **Wire real data into the actual dashboard.** `DashboardPage.tsx`'s Telemetry tab is still 100% rendering `mock.ts` — nothing built so far has changed what's on screen. This is the original goal of this whole thread and is last on the list, not first.
