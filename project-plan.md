# Software Development Management Portal — Project Plan

## 1. Product identity

A portal for engineering teams to manage the full lifecycle of their projects:

1. **In development** — projects tracked via their GitHub repo (DORA-style metrics, activity)
2. **Post development** — projects that are live, tracked via infra metrics (AWS CloudWatch / Cloudflare Analytics)
3. **External telemetry** — real usage data from any launched project, via a drop-in JS snippet

One portal, one auth layer, one dashboard — three data domains feeding into it per-project.

---

## 2. Core features

- **Auth** — login/logout, JWT-based; `role` column on `users` (`admin` / `member`) from day one — trivial to add now, gate a couple of admin-only actions (e.g. connecting a new AWS/GitHub credential) behind it, skip building any real permissions UI
- **Project entity** — the thing that ties everything together; a project can have a linked GitHub repo, a linked live deployment, or both
- **Dashboard** — tables + graphs (recharts) across all three domains, filterable per project
- **In-development view** — DORA-style metrics per project (see §4)
- **Post-development view** — infra health metrics per project (see §5)
- **External telemetry view** — usage metrics per project via the JS snippet (see §6)

---

## 3. App stack & topology (the portal itself)

**Stack:** NestJS (API) + React/Vite (frontend) + PostgreSQL — matches existing experience, no reason to deviate.

**AWS topology:**

```
Route 53 → CloudFront → S3 (React static build)
                 │
                 ▼
              ALB → ECS Fargate (NestJS API, private subnet)
                          │
                          ▼
                    RDS Postgres (private subnet)

+ ECR (Docker image registry)
+ Secrets Manager (GitHub PAT, AWS keys, Cloudflare tokens — encrypted, never plain columns)
+ CloudWatch (portal's own logs — separate from the CloudWatch metrics you're *pulling* from users' target infra)
+ EventBridge Scheduler or ECS scheduled task — cron trigger for the poller job (§5)
```

**Alternative hosting noted, not built:** self-managed ECS-on-EC2 or raw EC2+Docker Compose.

**Why Fargate, precisely (for the write-up):**
- EC2 is a VM, not a container service — ECS is the orchestrator that decides where containers run; Fargate is the ECS launch type where AWS supplies that compute for you, vs. ECS-on-EC2 where you provision and manage the underlying instances yourself.
- The ALB's job (route traffic across running containers, health-check them) is identical either way — it's not what Fargate saves you.
- What Fargate removes is a **second, dependent scaling layer**. Both setups need ECS Service Auto Scaling (decides how many *tasks* to run, based on CPU/memory/request count). ECS-on-EC2 additionally needs an EC2 Auto Scaling Group (decides how many *instances* exist) linked via ECS Capacity Providers — if a task needs to schedule and there's no room on existing instances, it sits pending until the EC2 ASG notices and boots a new instance (a real, minutes-long lag). Fargate has no second layer and no lag.
- ECS-on-EC2 also means owning: OS patching, Docker/ECS agent updates, instance sizing, disk cleanup, SSH/security-group management, and handling instance failure/replacement — all real ongoing surface area that buys nothing for this project's actual point (demonstrating DORA metrics, telemetry, dashboards).
- Subnets are a one-time VPC design decision either way, not something scaling creates — worth not conflating the two.

---

## 4. In-development metrics (GitHub)

**Build: poll-only.** GitHub REST API on a schedule (see cadence below).

**Webhook ingestion — mention in final write-up, not built.** `POST /webhooks/github` (HMAC-signature verified) for real-time events (push, PR opened/merged, release published) is the natural "next step" for lower-latency data — good to name as a considered future improvement, not worth the build time (public endpoint + signature verification) given polling already covers the metrics needed.

**Metrics computed:**
- Deployment Frequency (releases/tags, or merges to `main`)
- Lead Time for Changes (first commit → PR merge)
- *(stretch)* PR review turnaround, PR size, issue-to-first-commit time

**Not included** (need data GitHub doesn't have): Change Failure Rate, MTTR — note as "future: requires incident tracking integration."

**Onboarding:** user provides a GitHub PAT + org/repo name to register a project's dev-side connection.

---

## 5. Post-development metrics (live infra)

**Scheduled poller** — runs hourly by default, plus a manual "refresh now" button per project. Confirmed comfortably within free/near-free limits for this scale:
- GitHub REST API: 5,000 requests/hour (authenticated) — nowhere close to hit for one org, hourly
- CloudWatch: `GetMetricData` is excluded from the free tier (~$0.01/1,000 requests) but negligible at this volume; `GetMetricStatistics` covers the same use case and is included in the 1M-request free tier if avoiding cost entirely matters
- Cloudflare Analytics API: general token rate limit (~1,200 requests/5 min) — hourly polling isn't close

Build order: **Cloudflare Analytics first** (zone already available to test against), AWS CloudWatch integration once a test AWS account/instance is set up.

**From AWS CloudWatch** (if project's live app runs on ECS/EC2/RDS):
- Request count, 4xx/5xx error rate, latency (p50/p99) — from ALB
- CPU/memory utilization — ECS task metrics
- RDS: connections, CPU, storage, IOPS
- Deployment events — ECS service deployment history (new task def, rollback)

**From Cloudflare Analytics API** (if project sits behind Cloudflare):
- Total requests, unique visitors, bandwidth
- Cache hit ratio, status code breakdown
- Threats blocked / bot traffic

**Onboarding:** user provides a scoped read-only IAM role/key (AWS) or API token (Cloudflare) to register a project's infra connection. For the take-home demo: point this at your own test AWS account/Cloudflare zone rather than building generic multi-account OAuth.

---

## 6. External telemetry (`THP_analytics.js`)

Single drop-in file, no new backend surface — POSTs to the same ingestion endpoint the portal already exposes.

```html
<script src="https://yourapp.com/THP_analytics.js" data-project-id="abc123"></script>
```

**Metrics captured:**
- Page views (URL, referrer, timestamp)
- Session start/end, rough duration
- Click events on tagged elements (`data-thp-track="..."`)
- Basic device/browser info (viewport, user agent)

Batches events client-side, sends via `fetch()` to `POST /telemetry`. Same pattern as GA4/Plausible/Fathom, self-hosted and minimal.

---

## 7. Data model sketch

- `users` — auth, role
- `projects` — name, owner, links to below
- `github_connections` — project_id, repo, encrypted PAT, webhook secret
- `infra_connections` — project_id, provider (aws/cloudflare), encrypted credentials
- `dev_metrics_snapshots` — project_id, metric type, value, timestamp (from GitHub poll/webhook)
- `infra_metrics_snapshots` — project_id, metric type, value, timestamp (from CloudWatch/Cloudflare poll)
- `telemetry_events` — project_id, event_type, payload, timestamp (from JS snippet)

Three snapshot/event tables, one shared `projects` table tying them together — keeps the "two distinct things to monitor" cleanly separated while still living in one portal.

---

## 8. Decisions locked in

- Role column (`admin`/`member`) included, no permissions UI built
- Hourly polling + manual refresh button, for both GitHub and infra sources
- Webhook ingestion (GitHub) — write-up only, not built; poll-only for the actual app
- Fargate confirmed as hosting choice; EC2-on-ECS explainer kept in doc for interview follow-up questions
- Build order: Cloudflare Analytics (zone in hand) → AWS CloudWatch (test account set up later)
