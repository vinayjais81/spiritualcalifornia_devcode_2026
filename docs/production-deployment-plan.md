# Production Deployment Plan — spiritualcalifornia.com

**Status:** Proposed / ready to execute
**Date:** 2026-08-20
**Supersedes for prod:** `AWS_DEPLOYMENT_PLAN.md` (that document describes the QA box only)

---

## 1. Objective and scope

Stand up a **second, fully independent environment** — Production — inside the **same client AWS account** that today hosts QA (`spiritualcalifornia.nityo.in`), and map it to the live domain **`spiritualcalifornia.com`**.

Prime objectives, in priority order:

1. **Security** — a compromise of QA (weaker controls, test data, shared credentials, ad-hoc SSH) must not be able to reach production data, secrets, or money movement.
2. **Availability** — no single EC2 instance, AZ, or manual deploy step may be a single point of failure for a revenue-carrying site.
3. **Scalability** — the design must absorb a 10× traffic increase by changing numbers, not architecture.

Out of scope: application feature work, the practitioner-import content pipeline, and the eventual ECS Fargate migration (called out as Phase 2 in §13).

**Explicitly assumed** (per the constraint that live credentials are swapped manually): the operator populates live third-party keys themselves. This plan specifies *where* those keys live, *which* ones must change, and *what breaks if they don't* — but does not require any live secret to be known during infrastructure build-out.

---

## 2. Current state — what QA actually is

| Layer | QA today |
|---|---|
| DNS | `spiritualcalifornia.nityo.in` (A record → Elastic IP) |
| Compute | 1 × EC2, Ubuntu, PM2 running `sc-api` (:3001) + `sc-web` (:3000) |
| Ingress | Nginx on the box, Let's Encrypt certificate, path-routes `/api/*` → 3001, `/*` → 3000 |
| Database | RDS PostgreSQL **17.9** (`database-1`), `db.t3.micro`, single-AZ, 20 GiB, **1-day backup retention**, no deletion protection |
| Cache/queues | **No ElastiCache exists** — Redis runs locally on the EC2 instance. BullMQ workers run **in-process** inside `sc-api`. Production is therefore the first time this app talks to a remote, authenticated Redis |
| Storage | S3 bucket, pre-signed direct browser uploads |
| Deploy | GitHub Actions `deploy.yml` → SSH → `git reset --hard origin/main` → `npm ci` → `prisma migrate deploy` → `npm run seed:pages` → build → `pm2 restart` |
| Secrets | `.env` files edited by hand on the instance |
| Network | Default VPC, public subnet, SSH open to an allow-listed IP |

**Everything above is acceptable for QA and none of it is acceptable for production.** Production is not a copy of this box; it is a different topology running the same artifacts.

---

## 3. Target architecture

```
                            Route 53 — spiritualcalifornia.com (public hosted zone)
                                            │
                                    A/ALIAS apex + www
                                            │
                                  ┌─────────▼─────────┐
                                  │   AWS WAF v2      │  managed rules + rate limit
                                  └─────────┬─────────┘
                                            │
                          ┌─────────────────▼──────────────────┐
                          │ Application Load Balancer (public) │  ACM cert, TLS 1.2+, HTTP→HTTPS
                          │  listener rules (priority order):  │
                          │   10  /api/revalidate-static-page → web-tg   ← MUST sit above /api/*
                          │   20  /api/*                      → api-tg  (:3001)
                          │  default                          → web-tg  (:3000)
                          └───────┬──────────────────┬─────────┘
                                  │ AZ-a             │ AZ-b
                     ┌────────────▼───────┐  ┌───────▼────────────┐   private app subnets
                     │ EC2  sc-prod-app-1 │  │ EC2 sc-prod-app-2  │   Auto Scaling Group
                     │ PM2: sc-api,sc-web │  │ PM2: sc-api,sc-web │   no public IP, no SSH
                     └────────┬───────────┘  └───────┬────────────┘
                              │                      │
        ┌─────────────────────┼──────────────────────┼──────────────────────┐
        │                     │                      │                      │
┌───────▼────────┐   ┌────────▼─────────┐   ┌────────▼────────┐   ┌─────────▼────────┐
│ RDS PostgreSQL │   │ ElastiCache Redis│   │ S3 sc-prod-     │   │ NAT GW + VPC     │
│ 16, Multi-AZ   │   │ repl. group,     │   │ uploads (KMS)   │   │ endpoints (S3,   │
│ KMS, PITR 14d  │   │ Multi-AZ failover│   │  └ CloudFront   │   │ SSM, KMS, logs)  │
│ private subnet │   │ private subnet   │   │    OAC          │   │                  │
└────────────────┘   └──────────────────┘   └─────────────────┘   └──────────────────┘

  Outbound to Stripe / Resend / Anthropic / Zoom / Calendly / Textract via NAT GW
  Operator shell access via SSM Session Manager only (port 22 closed everywhere)
```

Key differences from QA, and why:

| Change | Reason |
|---|---|
| ALB instead of Nginx-on-box | TLS terminates outside the instance; per-service health checks; instances become replaceable; WAF attach point; scale-out is a number change. |
| Auto Scaling Group (min 2, across 2 AZs) | Instance or AZ loss is self-healing. Also the only way a "cattle not pets" `.env`-from-SSM model works. |
| RDS Multi-AZ | Automatic failover on host/AZ failure; ~60–120s, no data loss. |
| Redis replication group, Multi-AZ | BullMQ holds stock reservations, payout crons, invite scheduling. Losing Redis silently stalls money-adjacent jobs. |
| Private subnets + SSM Session Manager | No inbound port 22 anywhere; no SSH key to leak; every operator session logged in CloudTrail. |
| Secrets in SSM Parameter Store | Survives instance replacement, versioned, KMS-encrypted, IAM-scoped, audit-logged. A hand-edited `.env` on an ASG instance is lost at the next scale event. |
| CloudFront in front of S3 | Uploads/journal images served from edge via Origin Access Control; bucket stays fully private. |

---

## 4. Isolation model — two environments, one AWS account

This is the crux of the constraint. A single account has no hard tenancy boundary, so isolation is assembled from five independent layers. **No single layer failing may be sufficient to cross the boundary.**

### Layer 1 — Network
- Production gets a **dedicated VPC**, `sc-prod-vpc`, CIDR **10.20.0.0/16**.
- QA stays where it is (default VPC, typically `172.31.0.0/16`).
- **No VPC peering, no Transit Gateway, no shared subnets, ever.** The two VPCs have no route to each other. This is the strongest control available in a shared account — write it into the runbook as a standing prohibition.
- Prod security groups reference **only other prod security groups** as sources — never CIDR ranges that could later be widened.

### Layer 2 — Identity
- Separate IAM roles, no shared users:
  - `sc-prod-ec2-role` — instance profile; read `/sc/prod/*` SSM params, read/write `sc-prod-uploads`, invoke Textract, write CloudWatch logs. Nothing else.
  - `sc-prod-deploy-role` — assumed by GitHub Actions via **OIDC** (no long-lived AWS access keys in GitHub).
  - `sc-prod-breakglass` — human admin, MFA-required, alarmed on assumption.
- Every prod policy is scoped by ARN prefix **and** by tag:

```json
{
  "Effect": "Allow",
  "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
  "Resource": "arn:aws:ssm:us-west-1:<ACCOUNT_ID>:parameter/sc/prod/*"
}
```

- Attach an **IAM permission boundary** to the QA deploy role that explicitly denies any action on prod-tagged resources:

```json
{
  "Effect": "Deny",
  "Action": "*",
  "Resource": "*",
  "Condition": { "StringEquals": { "aws:ResourceTag/Environment": "prod" } }
}
```

  This is the control that makes "same account" survivable: even a fully compromised QA deploy credential cannot touch a prod-tagged resource.

### Layer 3 — Data and keys
- Separate **customer-managed KMS keys**: `alias/sc-prod-rds`, `alias/sc-prod-s3`, `alias/sc-prod-ssm`. Key policies grant only prod principals — QA roles appear in no prod key policy, so even an accidental snapshot share is unreadable.
- Separate RDS instance, separate ElastiCache cluster, separate S3 buckets. **No shared database, ever, not even read-only.**
- **Production launches with an empty database.** Per `docs/pre-launch-data-purge.md`, QA holds demo data — it is not migrated. Seeding is limited to reference data (§7, P13).

### Layer 4 — Credentials to third parties
- Stripe **live** keys exist only in `/sc/prod/*`. QA keeps sandbox keys. A leaked QA `.env` cannot move real money.
- Distinct Stripe webhook endpoints and signing secrets, distinct Connect platform, distinct Resend key, distinct Google OAuth client, distinct Calendly app, distinct Zoom credentials.
- Distinct JWT signing secrets — a QA-issued token must be worthless in prod.

### Layer 5 — Operational
- Naming prefix `sc-prod-*` vs `sc-qa-*` on **every** resource. No resource may be un-prefixed.
- Mandatory tags on everything (§5).
- Deletion protection on RDS and the ALB; versioning on the S3 buckets.
- Separate GitHub Actions workflow, separate GitHub Environment with **required reviewer approval** on prod deploys.

> **Recommendation, recorded and deliberately non-blocking:** the textbook answer is two AWS accounts under an Organization with an SCP. If the client ever authorises that, the migration path is: create `SpiritualCalifornia-Prod` → re-run this document → RDS snapshot share + restore → DNS cutover. Everything below is written so that move is a re-run rather than a redesign. Until then, the five layers above are the mitigation, and they are sufficient **provided Layer 2's permission boundary is actually applied.**

---

## 5. Naming and tagging standard

Every production resource carries:

| Tag | Value |
|---|---|
| `Environment` | `prod` (QA gets `qa` — retro-tag it; the permission boundary depends on it) |
| `Project` | `spiritual-california` |
| `Owner` | `engineering` |
| `CostCenter` | `sc-prod` |
| `ManagedBy` | `terraform` or `manual` |

Names: `sc-prod-<service>-<qualifier>` — `sc-prod-vpc`, `sc-prod-alb`, `sc-prod-rds-pg16`, `sc-prod-redis`, `sc-prod-uploads`, `sc-prod-app-asg`, `sc-prod-api-tg`, `sc-prod-web-tg`.

Enforce with an AWS Config `required-tags` rule → SNS on non-compliance. An untagged prod resource is invisible to the isolation policy, which makes it a security hole, not just untidiness.

---

## 6. Locked decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Region | **us-west-1 (N. California)** — same region as QA | REVISED 2026-08-20 after verification against the live account. The original recommendation was us-west-2, largely because Textract was believed unavailable in us-west-1; **that was checked in the client account and is false — Textract is available in us-west-1.** With that argument gone, parity wins: one region to reason about for a one-dev team, and the dedicated VPC already supplies the isolation a second region would have added. us-west-1 offers two AZs to this account (`us-west-1a`, `us-west-1c`), which is enough for Multi-AZ RDS and a two-AZ ASG. Costs roughly 10% more than Oregon (~$40/mo at this scale) — accepted. |
| D2 | Compute | **EC2 + ASG + PM2**, not ECS Fargate | Keeps the pipeline the team already operates. Containerisation is Phase 2 (§13); doing it during a launch adds a second unproven variable. |
| D3 | Ingress | **ALB path-based routing**; Nginx dropped | Two target groups on the same instances (:3000, :3001), each health-checked independently. See the `/api/revalidate-static-page` trap in §10.1. |
| D4 | Single origin | Frontend and API both on **`https://spiritualcalifornia.com`** — no `api.` subdomain | The refresh-token cookie is `sameSite: 'strict'` in production (`auth.controller.ts:260`). Splitting the API onto a subdomain makes every refresh cross-site and **silently breaks session renewal**. Same-origin is a hard requirement, not a preference. |
| D5 | Canonical host | apex `spiritualcalifornia.com`; `www.` **301-redirects** to apex | `NODE_ENV=production` locks CORS to exactly `[FRONTEND_URL]` (`main.ts:38-41`). If `www` *serves* the app, every API call from `www` fails CORS. It must redirect at the ALB, not be served. |
| D6 | Database | RDS PostgreSQL **17.x** (matching QA 17.9), **Multi-AZ instance**, `db.t4g.medium` to start | Multi-AZ *cluster* mode requires m6gd/r6gd class — overkill at launch. t4g.medium → r6g.large is a resize, not a rebuild. |
| D7 | Secrets | **SSM Parameter Store SecureString**, one blob per app: `/sc/prod/api/dotenv`, `/sc/prod/web/dotenv` | Satisfies "I'll edit live creds manually" — the operator edits one encrypted parameter — while surviving instance replacement and giving versioning + instant rollback. Parameter Store Standard is free; Secrets Manager costs $0.40/secret/mo and buys rotation the app can't use yet. |
| D8 | Data migration | **None. Prod starts empty.** | QA holds demo/test data. Copying it would import test accounts, fake payouts and sandbox Stripe IDs. |
| D9 | Deploy trigger | Manual dispatch / tag on a **`production` branch**, GitHub Environment with required approval | `main` → QA stays automatic. Prod never deploys on a merge. |
| D10 | Migrations | `prisma migrate deploy` in the pipeline, **after** an automated RDS snapshot, on the first instance only | The 51 existing migrations are additive and QA-tested. The snapshot is the rollback. |

---

## 7. Implementation phases

Effort assumes one senior engineer. P1–P8 are infrastructure and can be built before any live credential exists.

### P0 — Code prerequisites (~1.5 days)

Application changes production requires and QA currently masks. Do these in `main` so QA validates them first.

| # | Change | Why it's needed | Where |
|---|---|---|---|
| P0.1 | **Trust the proxy.** Create the app as `NestExpressApplication`, call `app.set('trust proxy', 1)` | Behind an ALB every request arrives from the load balancer. `ThrottlerModule` (`app.module.ts:46`) keys limits on `req.ip`, so **all users would share one bucket of 10 req/sec** — a self-inflicted outage at normal traffic. Also required for correct client IPs in audit logs. | `Backend/api/src/main.ts` |
| P0.2 | **Shared throttler storage** (Redis adapter) | With 2+ instances, in-memory counters mean the effective limit is `limit × instances`, enforced inconsistently. | `Backend/api/src/app.module.ts` |
| P0.3 | **Real health endpoints.** `GET /api/v1/health` → Prisma `SELECT 1` + Redis `PING`, 200/503. Plus a static `/healthz` route in Next.js | The ALB needs a cheap, honest liveness signal. Today the only API route is `GET /api/v1` returning "Hello World" — it stays 200 while the database is down, so the ALB would keep routing to a dead instance. Using `/` for the web check costs a full React render every 30s per instance. | `Backend/api` + `Frontend/web/src/app/healthz/route.ts` |
| P0.4 | **Graceful shutdown.** `enableShutdownHooks()` + drain BullMQ workers on SIGTERM | Rolling deploys and ASG replacement send SIGTERM. Without draining, an in-flight stock-hold release or payout job dies mid-transaction. | `main.ts` + the five `*.queue.ts` `onModuleDestroy` |
| P0.5 | **Content Security Policy.** Helmet's default CSP switches on in production (`main.ts:33`) and has never been exercised | Stripe.js, Calendly embeds, Zoom, CloudFront images and Google Fonts will be blocked — this breaks checkout on day one. Set explicit `contentSecurityPolicy.directives` and verify on QA under `NODE_ENV=production`. | `Backend/api/src/main.ts` |
| P0.6 | **Verify worker kill-switches** gate cleanly to `false` (`ORDER_TASKS_ENABLED`, `TOUR_TASKS_ENABLED`, `PAYOUTS_TASKS_ENABLED`, `INVITE_TASKS_ENABLED`) | Lets us pin crons to one instance if BullMQ repeatable-job dedup proves insufficient (§10.14). | already implemented — verify only |
| P0.7 | **Soak `NODE_ENV=production` on QA for a day** | CSP, HSTS, strict CORS and `sameSite: strict` deserve a deliberate soak before real users meet them. | QA box |

### P1 — Account foundation (~0.5 day)

1. **CloudTrail** — multi-region trail, log-file validation on, delivering to `sc-prod-logs`, 400-day lifecycle. This is the only forensic record of a cross-environment incident.
2. **GuardDuty** — enable with S3 and RDS protection. ~$10–30/mo; catches credential exfiltration and crypto-mining on a compromised instance.
3. **AWS Config** — with `required-tags`, `rds-storage-encrypted`, `s3-bucket-public-read-prohibited`, `restricted-ssh`.
4. **Security Hub** — AWS Foundational Security Best Practices. It will immediately flag the QA box's open SSH; that's fine, it's the tracking mechanism.
5. **AWS Budgets** — one budget at the §11 figure, alerts at 80/100/120%. Cost is an availability control: a surprise bill on a client account gets things turned off.
6. **Retro-tag QA** `Environment=qa`. The prod-deny boundary keys on tags; untagged resources sit outside the policy.
7. **GitHub OIDC provider** + `sc-prod-deploy-role`, trust scoped to the exact repo **and** environment:

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::<ACCT>:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:<org>/<repo>:environment:production"
    }
  }
}
```

   This removes AWS access keys from GitHub secrets entirely.

8. **Check service quotas** in us-west-1 on day one: EC2 vCPU, Elastic IPs, VPCs per region, RDS instances.

### P2 — Network (~0.5 day)

| Resource | Spec |
|---|---|
| VPC | `sc-prod-vpc`, `10.20.0.0/16`, DNS hostnames + resolution on |
| Public subnets | `10.20.0.0/24` (us-west-1a), `10.20.1.0/24` (us-west-1c) — ALB + NAT only |
| Private app subnets | `10.20.10.0/24` (us-west-1a), `10.20.11.0/24` (us-west-1c) — EC2 |
| Private data subnets | `10.20.20.0/24` (us-west-1a), `10.20.21.0/24` (us-west-1c) — RDS + ElastiCache |
| IGW | attached; routed only from public subnets |
| NAT Gateway | 1, in us-west-1a to start (see trade-off below) |
| VPC endpoints | **Gateway:** S3 (free, keeps upload traffic off NAT). **Interface:** `ssm`, `ssmmessages`, `ec2messages` (required for Session Manager without internet), `logs`, `kms`, `secretsmanager` |
| Flow logs | → CloudWatch Logs, 30-day retention |

**Security groups** — source is always another SG, never a CIDR:

| SG | Inbound | Source |
|---|---|---|
| `sc-prod-alb-sg` | 443, 80 | `0.0.0.0/0` |
| `sc-prod-app-sg` | 3000, 3001 | `sc-prod-alb-sg` |
| `sc-prod-app-sg` | — | *no SSH rule at all* — access via SSM Session Manager |
| `sc-prod-rds-sg` | 5432 | `sc-prod-app-sg` |
| `sc-prod-redis-sg` | 6379 | `sc-prod-app-sg` |
| `sc-prod-vpce-sg` | 443 | `sc-prod-app-sg` |

> **Single-NAT trade-off, stated plainly:** one NAT Gateway is $32/mo; two are $64/mo. With one NAT in AZ-a, an AZ-a outage leaves AZ-b instances unable to reach Stripe or Resend — inbound traffic survives, outbound integrations do not. **Recommendation: one NAT at launch, second when payment volume justifies it**, recorded as accepted risk. If the client's availability appetite is stricter, add it now.

### P3 — Data tier (~0.5 day + provisioning wait)

**RDS PostgreSQL**

```
Identifier:            sc-prod-rds-pg16
Engine:                PostgreSQL 17.x — QA runs 17.9; match its minor version at launch
Class:                 db.t4g.medium (2 vCPU / 4 GiB) → r6g.large when p95 CPU > 60%
Multi-AZ:              Yes (instance deployment)
Storage:               100 GiB gp3, autoscaling to 500 GiB
Encryption:            KMS, alias/sc-prod-rds
Subnet group:          private data subnets
Security group:        sc-prod-rds-sg
Public access:         No
Backups:               14-day retention, window 09:00–10:00 UTC (≈02:00 PT)
Performance Insights:  on (7-day free tier)
Enhanced monitoring:   60s
Deletion protection:   YES
Auto minor upgrade:    Yes; maintenance window Tue 10:00–11:00 UTC
Parameter group:       custom — log_min_duration_statement=1000,
                       log_connections=on, rds.force_ssl=1
Master user:           scadmin (generated password, stored at /sc/prod/rds/master)
```

`rds.force_ssl=1` makes an unencrypted connection impossible rather than merely discouraged. The Prisma URL then needs `sslmode=require` (§8).

**Application DB user** — do not run the app as the RDS master:

```sql
CREATE USER sc_app WITH PASSWORD '<generated>';
GRANT CONNECT ON DATABASE spiritual_california TO sc_app;
GRANT USAGE, CREATE ON SCHEMA public TO sc_app;   -- CREATE is needed by prisma migrate deploy
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sc_app;
```

**ElastiCache Redis**

```
Name:                sc-prod-redis
Engine:              Redis 7.x, cluster mode DISABLED   ← BullMQ/ioredis expect one logical node
Node type:           cache.t4g.micro primary + 1 replica
Multi-AZ:            Yes, automatic failover on
Encryption:          at rest (KMS) + in transit (TLS)
AUTH token:          enabled → REDIS_PASSWORD
Subnet group:        private data subnets
Snapshot retention:  1 day (queue state, not a system of record)
Maxmemory policy:    noeviction   ← BullMQ job data must not be evicted under pressure
```

> `noeviction` is deliberate. The default `allkeys-lru` discards queued jobs when memory tightens — silently dropping stock-hold releases and payout runs. Alarm on memory instead (§P10).

> **In-transit TLS note:** enabling TLS means the BullMQ connections need `tls: {}` in their options. All five queue files build the connection inline as `{ host, port, password }` — either add the TLS option alongside P0, or launch with in-transit encryption off inside the private subnet and record it as accepted. **Recommendation: add the TLS option** — a four-line change across `order-tasks`, `tour-tasks`, `payouts-tasks`, `invite-tasks`, `identity-reconcile`.

### P4 — Storage and CDN (~0.5 day)

**`sc-prod-uploads`** — private, KMS `alias/sc-prod-s3`, versioning on, all four Block Public Access flags on.

CORS — the browser PUTs directly to S3 with a pre-signed URL, so the live origin must be listed or **every upload fails with an opaque CORS error**:

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
  "AllowedOrigins": ["https://spiritualcalifornia.com"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]
```

Lifecycle: abort incomplete multipart uploads after 7 days; noncurrent versions → Glacier IR at 90 days.

**CloudFront distribution** in front of the bucket with an **Origin Access Control**; bucket policy grants only that distribution. Set `AWS_CLOUDFRONT_URL` to the distribution domain, or to `cdn.spiritualcalifornia.com` with an ACM cert **in us-east-1** (CloudFront accepts us-east-1 certs only).

`next.config.ts` already allow-lists `**.cloudfront.net` and `**.amazonaws.com` for `next/image` — a `cloudfront.net` domain needs no code change; a custom `cdn.` domain does.

**`sc-prod-logs`** — ALB access logs + CloudTrail, 400-day lifecycle to Glacier.

### P5 — Secrets and configuration (~0.5 day)

Two SecureString parameters, each holding a complete `.env`:

```
/sc/prod/api/dotenv    (SecureString, alias/sc-prod-ssm)  → Backend/api/.env
/sc/prod/web/dotenv    (SecureString, alias/sc-prod-ssm)  → Frontend/web/.env.local
```

The deploy step writes them to disk `0600`, owned by `ubuntu`. The operator edits them in the SSM console (or `aws ssm put-parameter --overwrite`); every edit is a new version with a diff and an instant rollback.

> **Hard rule:** a backend env var **not declared in `Backend/api/src/config/env.validation.ts` is stripped by Zod and reaches the app as `undefined`**, no matter what `.env` says. Any production-only variable must be added to that schema in the same commit.

#### Backend production `.env` inventory

Required by the Zod schema — **the API refuses to boot if any is missing or empty**:

| Variable | Production value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Turns on HSTS, CSP, strict CORS, `sameSite: strict` cookies; disables Swagger |
| `PORT` | `3001` | |
| `FRONTEND_URL` | `https://spiritualcalifornia.com` | **Exact — no trailing slash, no `www`.** This is the entire CORS allow-list in prod |
| `DATABASE_URL` | `postgresql://sc_app:<pw>@sc-prod-rds-pg16…:5432/spiritual_california?schema=public&sslmode=require` plus a separate `DATABASE_POOL_MAX` | **`connection_limit` does NOT work here** — PrismaService drives a `pg` Pool via @prisma/adapter-pg, which never reads it. See §8 |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | ElastiCache primary endpoint / 6379 / AUTH token | Queues read `REDIS_HOST`/`PORT`, **not** `REDIS_URL` |
| `REDIS_TLS` | `true` | **Required** if the replication group has in-transit encryption on, or every queue fails to connect |
| `REDIS_URL` | `rediss://:<auth>@<primary>:6379` | Read only by `CacheService`. Note `rediss://` (two s) when TLS is on |
| `CACHE_ENABLED` | `false` at launch → `true` once invalidation is verified under real traffic | The cache had never run in any environment before 2026-08-20, so it goes live deliberately and separately. Off costs nothing but database load |
| `TRUST_PROXY_HOPS` | `1` (the ALB) | Wrong value either breaks per-client rate limiting or lets a caller forge `X-Forwarded-For` |
| `DATABASE_POOL_MAX` | `10` to start | The real pool control — `connection_limit` in the URL is ignored. Budget `instances × processes × this` against RDS `max_connections` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` — **new, never reused from QA** | ≥32 chars enforced |
| `JWT_REFRESH_SECRET` | different `openssl rand -hex 32` | |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `30m` / `7d` | |
| `AWS_REGION` | `us-west-1` | |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | see note below | |
| `AWS_S3_BUCKET` | `sc-prod-uploads` | |
| `AWS_CLOUDFRONT_URL` | `https://<dist>.cloudfront.net` | |
| `STRIPE_SECRET_KEY` | `sk_live_…` | operator-supplied at cutover |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the **prod** endpoint | |
| `STRIPE_PLATFORM_COMMISSION_PERCENT` | `20` | Fallback only — live rates come from `CommissionRate` rows (`docs/commission-display-truth.md`). Set 20 anyway so the fallback can't display a stale 15% |
| `RESEND_API_KEY` | live key | |
| `EMAIL_FROM` | `noreply@spiritualcalifornia.com` | Domain must be verified in Resend (§P7) |
| `ALGOLIA_APP_ID` / `ALGOLIA_ADMIN_API_KEY` / `ALGOLIA_SEARCH_API_KEY` | `disabled` (literal placeholder) | Schema requires `min(1)` even though `ALGOLIA_ENABLED=false` routes search to Postgres FTS. Non-empty placeholders keep boot from failing |
| `ALGOLIA_ENABLED` | `false` | |
| `ANTHROPIC_API_KEY` | live key | |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | |
| `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | live app credentials | Required by schema — placeholders if Zoom isn't launching |
| `CALENDLY_CLIENT_ID` / `_SECRET` / `_WEBHOOK_SECRET` | live app | Required by schema |
| `CALENDLY_REDIRECT_URI` | `https://spiritualcalifornia.com/api/v1/calendly/callback` | Must be a valid URL and registered in the Calendly app |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_CALLBACK_URL` | live OAuth client; callback `https://spiritualcalifornia.com/api/v1/auth/google/callback` | Optional in schema |
| `STATIC_PAGE_REVALIDATE_SECRET` | random 32+ chars, **identical to the frontend value** | Mismatch ⇒ CMS/legal pages stay stale up to 5 minutes |

Behaviour flags — set these explicitly:

| Variable | Production value | Consequence if wrong |
|---|---|---|
| `LEDGER_V2_ENABLED` | `true` | Off ⇒ payouts fall back to v1 accounting |
| `AUTO_PAYOUT_ENABLED` | `false` at launch; `true` after the first manual cycle reconciles | Don't auto-sweep real money on day one |
| `PAYOUTS_TASKS_ENABLED` / `ORDER_TASKS_ENABLED` / `TOUR_TASKS_ENABLED` | `true` | `ORDER_TASKS_ENABLED=false` ⇒ abandoned carts hold stock forever |
| `ORDER_HOLD_MINUTES` | default (`docs/order-hold-expiry.md`) | |
| `MIN_PAYOUT_USD` | `100` | |
| `STRIPE_PROCESSING_FEE_PERCENT` / `_FLAT` | live Stripe pricing | Platform absorbs the fee — wrong values distort guide earnings |
| `INVITE_EMAIL_MODE` | **`redirect` at launch**; `live` only on explicit sign-off | Defaults to `redirect` in code precisely so a fresh environment cannot mass-mail real practitioners |
| `INVITE_EMAIL_REDIRECT_TO` | an internal address | |
| `INVITE_SEND_PER_DAY` | start at `25` | Protects reputation on a brand-new sending domain |
| `INVITE_TASKS_ENABLED` | `false` until invites go live | |
| `TEST_ACCOUNT_EMAIL_DOMAIN` | `scprelaunch.test` | Keep — the claim/convert flow depends on it |
| `EMAIL_HASH_SECRET` | `openssl rand -hex 32` | Falls back to `JWT_ACCESS_SECRET` if unset; set it explicitly |
| `RESEND_WEBHOOK_SECRET` | from the Resend dashboard | |
| `SUPPORT_EMAIL` | `support@spiritualcalifornia.com` | |
| `RETURN_WINDOW_DAYS` | per policy | |
| `GUIDE_FREE_PERIOD_DAYS` | per commercial decision | Becomes the Stripe trial length |
| `STRIPE_SUBSCRIPTION_PRICE_MONTHLY` / `_ANNUAL` | **pin real live Price IDs** | Left unset, the backend lazily *creates* Prices — fine in sandbox, not in production |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | live value | Unset ⇒ verification stays in stub mode, no guide is ever verified, no guide is publicly visible |

> **AWS credentials on the instance:** the app currently reads `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` from env. AWS SDK v3's default credential chain picks up the **instance profile** automatically when those are absent — strictly better (no static keys, auto-rotating). *Recommended:* verify each SDK client is constructed without explicit `credentials`, then omit both variables and let `sc-prod-ec2-role` supply them. If some client passes them explicitly, either fix that (small change) or create a tightly-scoped IAM user as a stopgap with a removal date.

#### Frontend production `.env.local`

`NEXT_PUBLIC_*` values are **inlined at build time** — changing one needs a rebuild, not a restart.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://spiritualcalifornia.com/api/v1` — **match QA's exact shape; read the QA file before writing this** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `NEXT_PUBLIC_ALGOLIA_*` | placeholders (Algolia dormant) |
| `NEXT_PUBLIC_SERVER_CART_ENABLED` | match QA |
| `STATIC_PAGE_REVALIDATE_SECRET` | identical to the backend value |

### P6 — Compute, load balancer, WAF (~1 day)

**Launch template `sc-prod-app-lt`**

- AMI: Ubuntu 24.04 LTS, **pinned ID** (don't silently track `latest`)
- Type: `t3.medium` (2 vCPU / 4 GiB). *Sizing note:* `next build` is memory-hungry; if builds OOM, move to `t3.large` or adopt the build-once model in §13
- **IMDSv2 required** (`HttpTokens: required`) — closes the SSRF → credential-theft path
- Root volume 40 GiB gp3, encrypted
- IAM instance profile `sc-prod-ec2-role`; no public IP; no key pair; `sc-prod-app-sg`
- User data: Node 22, PM2, CloudWatch agent, SSM agent; create `/var/www/spiritual-california`; register PM2 startup; then run the bootstrap deploy (§P8)

**Auto Scaling Group `sc-prod-app-asg`**

```
min 2 / desired 2 / max 6
Subnets:            both private app subnets (forces AZ spread)
Health check type:  ELB (not EC2) — a hung Node process must count as unhealthy
Grace period:       300s
Target tracking:    ALBRequestCountPerTarget = 800   (tune after week 1)
Instance refresh:   min healthy 50% (used for AMI rollouts)
Termination policy: OldestInstance
```

**ALB `sc-prod-alb`** — internet-facing, both public subnets, deletion protection on, access logs → `sc-prod-logs`, idle timeout 120s (long enough for Textract/Claude-backed verification calls), HTTP/2 on, drop-invalid-header-fields on.

Listeners:

| Port | Action |
|---|---|
| 80 | 301 → `https://#{host}:443/#{path}?#{query}` |
| 443 | ACM cert for apex + `www`, policy `ELBSecurityPolicy-TLS13-1-2-2021-06` |

443 rules, **in this priority order**:

| Priority | Condition | Action |
|---|---|---|
| 5 | Host = `www.spiritualcalifornia.com` | **301** → `https://spiritualcalifornia.com/#{path}` (D5) |
| 10 | Path = `/api/revalidate-static-page` | forward → `sc-prod-web-tg` |
| 20 | Path = `/api/*` | forward → `sc-prod-api-tg` |
| default | — | forward → `sc-prod-web-tg` |

> **Priority 10 is not optional.** Next.js owns exactly one route under `/api`: `Frontend/web/src/app/api/revalidate-static-page/route.ts`. The backend calls it at `${FRONTEND_URL}/api/revalidate-static-page` (`static-pages.service.ts:37`). Without the higher-priority exact-match rule, `/api/*` sends that call to NestJS, which 404s, and **every admin edit to Terms / Privacy / Refund pages stops publishing — silently**, because the caller doesn't surface the failure.

Target groups:

| TG | Port | Health check | Success |
|---|---|---|---|
| `sc-prod-web-tg` | 3000 | `/healthz`, 30s, 2 healthy / 3 unhealthy | 200 |
| `sc-prod-api-tg` | 3001 | `/api/v1/health/live`, 30s, 2/3 | 200 |

Both: deregistration delay 60s (drains in-flight requests); stickiness **off** — JWT auth is stateless, don't introduce sticky sessions.

**AWS WAF v2** web ACL on the ALB:

- `AWSManagedRulesCommonRuleSet`
- `AWSManagedRulesKnownBadInputsRuleSet`
- `AWSManagedRulesAmazonIpReputationList`
- `AWSManagedRulesSQLiRuleSet` (query string + body)
- Rate-based rule: 2000 requests / 5 min / IP → block
- **Exclusions, or you will break your own site:**
  - Allow-list `/api/v1/payments/webhook/stripe`, `/api/v1/verification/stripe-identity/webhook`, `/api/v1/invites/webhook/resend`, `/api/v1/calendly/webhook` **out of the rate-based rule**. Stripe retries bursty; a blocked webhook is a lost payment reconciliation.
  - Watch `CommonRuleSet`'s `SizeRestrictions_BODY` against rich-text (Tiptap) admin submissions.
  - Start the ACL in **Count mode for 48 hours**, read the sampled requests, then flip to Block.

### P7 — DNS, TLS, email (~0.5 day + propagation)

1. **Route 53 public hosted zone** for `spiritualcalifornia.com`; note the four NS records.
2. **Before touching the registrar:** lower the TTL on existing records at the current DNS provider to 300s and wait out the old TTL. This is what makes the cutover reversible in minutes rather than hours.
3. **ACM certificate** in **us-west-1** for apex + `www`, DNS-validated, auto-renew. (Separate us-east-1 cert if a `cdn.` CloudFront alias is used.)
4. Records:

| Name | Type | Value |
|---|---|---|
| `spiritualcalifornia.com` | A — ALIAS | `sc-prod-alb` |
| `www` | A — ALIAS | `sc-prod-alb` (the ALB rule redirects) |
| Resend DKIM | CNAME ×3 | from the Resend dashboard |
| SPF | TXT | the exact `include:` Resend specifies |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@spiritualcalifornia.com` → tighten to `p=quarantine` after two clean weeks |
| MX | MX | only if inbound mail is hosted here |

5. **Delegate the domain** — point the registrar's nameservers at the Route 53 set. Usually minutes; allow up to 48h.
6. **Resend domain verification must be green before launch.** `EMAIL_FROM` is already `noreply@spiritualcalifornia.com` — if the domain is unverified in the *production* Resend account, **every transactional email silently fails**: email verification, password reset, order confirmation, payout notice. This is the most common launch-day outage in this class of app.
7. **Warm the sending domain.** A brand-new domain sending thousands of invites on day one lands in spam. `INVITE_SEND_PER_DAY=25`, ramping weekly, is the mitigation.

### P8 — CI/CD (~1 day)

Create `.github/workflows/deploy-prod.yml`. Differences from `deploy.yml`, each deliberate:

| Aspect | QA | Production |
|---|---|---|
| Trigger | push to `main` | `workflow_dispatch` on `production`, or a `v*` tag |
| Approval | none | GitHub **Environment: production**, required reviewers |
| Auth | SSH key in secrets | **OIDC → `sc-prod-deploy-role` → SSM Send-Command** (no SSH, no static keys) |
| Concurrency | `deploy-qa` | `deploy-prod`, `cancel-in-progress: false` |
| Pre-flight | none | RDS snapshot `sc-prod-presnap-<sha>`, wait for `available` |
| Rollout | restart both at once | **one instance at a time**: deregister → deploy → health → re-register → next |
| Migrations | every deploy | first instance only, after the snapshot, with `prisma migrate status` in the log |
| Verify | `pm2 list` | 200 from `/api/v1/health` and `/healthz` *through the ALB*, plus a synthetic checkout smoke |
| Rollback | manual | documented, tested, one command (§P13) |

Per-instance script, executed via SSM (auditable, needs no inbound port):

```bash
set -euo pipefail
cd /var/www/spiritual-california

# 1. Config from SSM — survives instance replacement, never baked into an AMI
aws ssm get-parameter --name /sc/prod/api/dotenv --with-decryption \
  --query Parameter.Value --output text > Backend/api/.env
aws ssm get-parameter --name /sc/prod/web/dotenv --with-decryption \
  --query Parameter.Value --output text > Frontend/web/.env.local
chmod 600 Backend/api/.env Frontend/web/.env.local

# 2. Code — pinned SHA, never a moving branch ref
git fetch --all
git reset --hard "$TARGET_SHA"

# 3. Backend
cd Backend/api
npm ci
npx prisma generate
[ "$RUN_MIGRATIONS" = "true" ] && npx prisma migrate deploy
npm run seed:pages                 # idempotent: only creates missing slugs
rm -rf dist                        # stale layouts must not survive
npm run build
test -f dist/main.js || { echo "ERROR: dist/main.js missing"; ls -la dist; exit 1; }

# 4. Frontend
cd ../../Frontend/web
unset NODE_ENV                     # NODE_ENV=production makes npm ci skip devDeps → next build fails
npm ci
rm -rf .next
npm run build

# 5. Swap — restart, never `reload --update-env` (stale shell env trap)
pm2 restart sc-api
pm2 restart sc-web
pm2 save

# 6. Local gate before the ALB is allowed to send traffic back
for i in $(seq 1 30); do
  curl -fsS http://localhost:3001/api/v1/health && curl -fsS http://localhost:3000/healthz && exit 0
  sleep 2
done
echo "ERROR: health check never passed"; exit 1
```

Every hardening line above is carried over from the QA deploy-pipeline incident: `rm -rf dist`, the `test -f dist/main.js` gate, `unset NODE_ENV`, and `pm2 restart` instead of `reload --update-env`. Each exists because it silently broke a deploy once.

**New-instance bootstrap:** when the ASG launches a replacement, user-data runs the same script with `RUN_MIGRATIONS=false` and `TARGET_SHA` read from `/sc/prod/app/target-sha` — an SSM parameter the pipeline updates on every successful deploy. Without it, a 3 a.m. scale-out brings up an instance running whatever code the AMI happened to contain.

### P9 — Third-party go-live switches

None of these are infrastructure; all are launch-blocking. Owner is the operator, per the manual-credential constraint.

| Service | Action | Silent-failure mode if skipped |
|---|---|---|
| **Stripe** | Switch to live mode; live secret + publishable keys | Payments run against sandbox — orders "succeed", no money moves |
| **Stripe webhook** | New endpoint `https://spiritualcalifornia.com/api/v1/payments/webhook/stripe`, same events as QA, new signing secret | Payments capture but orders never confirm; holds expire and cancel paid orders |
| **Stripe Connect** | Complete live platform onboarding; guides re-onboard — **sandbox `acct_…` IDs do not carry over** | Guides cannot publish paid offerings (`canPublishPaidOffering` gate) |
| **Connect webhook** | `account.updated` must reach prod | Gate-drafted paid offerings never auto-restore |
| **Stripe Identity** | Live webhook + `STRIPE_IDENTITY_WEBHOOK_SECRET` | Verification stays in stub mode; no guide verified; no guide publicly visible |
| **Stripe Prices** | Create live $50/mo (and annual) Prices; pin the IDs | Backend auto-creates live Prices with unmanaged IDs |
| **Resend** | Verify the domain; live API key; webhook secret | **All transactional email fails silently** |
| **Google OAuth** | Add prod origin + `/api/v1/auth/google/callback`; move the app out of "Testing" | `redirect_uri_mismatch` on every Google sign-in |
| **Calendly** | Live app, redirect URI, webhook subscription | Guides cannot connect calendars |
| **Zoom** | Live Server-to-Server OAuth app | Session links not generated |
| **Anthropic** | Production API key with a spend cap | Document-analysis queue fails; verification stalls in `IN_REVIEW` |
| **Textract** | Confirm regional availability (D1); instance role needs `textract:AnalyzeDocument` | OCR silently fails; credentials never auto-extract |
| **S3 CORS** | Prod origin in the bucket CORS (§P4) | Every browser upload fails with an opaque error |
| **Sentry** | Create a production project, add the DSN | No error visibility (Sentry is **not currently installed** — §13) |

### P10 — Observability and alerting (~0.5 day)

CloudWatch agent on each instance (memory, disk, PM2 process metrics); `pm2-logrotate` installed; PM2 stdout/stderr shipped to `/sc/prod/api` and `/sc/prod/web` log groups, 30-day retention.

Alarms → SNS `sc-prod-alerts` → email + (recommended) Slack webhook:

| Alarm | Threshold | Why |
|---|---|---|
| ALB `HTTPCode_ELB_5XX_Count` | > 10 in 5 min | The site is broken |
| ALB `TargetResponseTime` p95 | > 2s for 10 min | Degrading before it breaks |
| ALB `UnHealthyHostCount` | ≥ 1 for 5 min | Instance down; at ≥2 the site is down |
| ASG `GroupInServiceInstances` | < 2 for 10 min | Redundancy lost |
| EC2 CPU | > 80% for 10 min | Scale-out signal |
| EC2 memory | > 85% | Node OOM precursor — `next build` is the usual culprit |
| RDS CPU | > 75% for 10 min | |
| RDS `FreeStorageSpace` | < 20 GiB | |
| RDS `DatabaseConnections` | > 70% of max | Prisma pool misconfiguration |
| RDS failover event | any | |
| Redis `DatabaseMemoryUsagePercentage` | > 75% | With `noeviction`, a full Redis **rejects writes** and queues stop accepting jobs |
| Redis `CurrConnections` → 0 | any | Workers detached |
| WAF `BlockedRequests` | sudden spike | Attack, or a bad rule blocking real users |
| Billing | > budget | |

Plus a **Route 53 health check** (or CloudWatch Synthetics canary) hitting `https://spiritualcalifornia.com/api/v1/health` from three regions every minute — external monitoring catches the failure modes internal monitoring shares a fate with.

**Business-level checks worth building in week 1:** a daily query for orders stuck `PENDING` past the hold window, payouts in `FAILED`, and verifications `IN_REVIEW` older than 48h. Infrastructure alarms will not tell you that Stripe webhooks stopped arriving; these will.

### P11 — Backup, restore, disaster recovery (~0.5 day)

Targets: **RPO 5 minutes** (RDS PITR granularity), **RTO 1 hour** (restore + DNS).

| Asset | Mechanism | Retention |
|---|---|---|
| PostgreSQL | Automated backups + PITR | 14 days |
| PostgreSQL | AWS Backup monthly snapshot to a separate vault | 12 months |
| PostgreSQL | Pre-deploy manual snapshot | 30 days |
| S3 uploads | Versioning + (recommended) CRR to `sc-prod-uploads-dr` in us-east-1 | Noncurrent → Glacier IR at 90d |
| Redis | Daily snapshot | 1 day — queue state, rebuildable |
| Config | SSM Parameter Store versioning | all versions |
| Code | GitHub + release tags | forever |

**A backup you have not restored is a hypothesis.** Schedule a restore drill in week 2 post-launch: restore the latest snapshot into `sc-prod-rds-restore-test`, point a scratch instance at it, verify row counts and a login, delete it. Record the wall-clock time — that number is the real RTO.

### P12 — Pre-launch security review

- [ ] `nmap` the ALB — only 80/443 answer; instances have no public IP at all
- [ ] No security group anywhere allows `0.0.0.0/0` on 22, 5432 or 6379
- [ ] SSM Session Manager is the only shell path; sessions logged to CloudTrail + S3
- [ ] IMDSv2 required on the launch template
- [ ] RDS and Redis not publicly accessible; `rds.force_ssl=1` proven by a failed non-SSL connection
- [ ] S3: Block Public Access on; bucket policy grants only the CloudFront OAC; no `*` principal
- [ ] TLS: SSL Labs grade **A** or better; HSTS present; TLS 1.0/1.1 refused
- [ ] CSP present **and** checkout still works (P0.5)
- [ ] `/api/docs` returns 404 in production — verify, don't assume
- [ ] JWT secrets differ from QA; a QA-issued token is rejected by prod
- [ ] Prod `.env` contains no `sk_test_` / `pk_test_` / sandbox values — grep for it
- [ ] The QA deploy role cannot read `/sc/prod/*` — assume it and try
- [ ] The prod EC2 role cannot reach QA resources — same test
- [ ] WAF in Block mode with webhook exclusions verified by a real Stripe test event
- [ ] Rate limiting is **per client IP**, not per load balancer (P0.1) — verify from two source IPs
- [ ] Admin panel: seeded admin credentials rotated; MFA story documented
- [ ] `npm audit --production` on both apps; criticals resolved
- [ ] Run `/security-review` against the release commit

### P13 — Cutover runbook

**T-7 days**
- P1–P8 complete; the site is live and testable at a temporary hostname (e.g. `prod-preview.nityo.in` → ALB) with WAF in Count mode
- Full regression on the preview host
- Reduce the current `spiritualcalifornia.com` DNS TTL to 300s

**T-2 days**
- Freeze `main`; cut the `production` branch
- Operator loads live credentials into `/sc/prod/api/dotenv` and `/sc/prod/web/dotenv`; deploy; **verify boot** — missing or invalid vars fail Zod validation loudly at startup, so read the logs rather than assuming
- Live Stripe webhook endpoints registered and delivering 200s in the Stripe dashboard
- Resend domain verified — send a real test to an external mailbox and confirm **inbox placement**, not just a 202
- Seed reference data: categories, `CommissionRate` rows, static pages, the admin user
- WAF flipped to Block; re-run the checkout smoke

**T-1 day**
- Final data check: the prod database contains **only** reference data. No demo guides, no test orders
- Full backup + snapshot taken
- Rollback rehearsed: old DNS values recorded, previous release SHA known
- On-call rota and incident channel agreed

**T-0 — go live**
1. Point the registrar's nameservers at Route 53 (or flip the A record if already delegated)
2. Watch resolution from several networks; watch ALB request count climb
3. Smoke, in this order:
   - Home, journal, practitioner listing, a guide profile
   - Seeker registration → verification email **arrives** → sign in
   - Guide registration → onboarding wizard → document upload lands in S3
   - Add to cart → checkout → **a real $1 charge** → visible in Stripe → confirmation email arrives → refund it
   - Admin login → approve a guide → guide becomes publicly visible
   - Edit a static page in admin → public page updates within seconds (this is the `/api/revalidate-static-page` rule proving itself)
4. Raise DNS TTL back to 3600 once stable
5. Leave QA untouched — it is the comparison baseline if something looks wrong

**T+1 to T+7**
- Daily: alarm review, error logs, Stripe webhook delivery rate, email bounce/complaint rate
- Day 3: tune WAF from sampled requests
- Day 7: restore drill (§P11); decide on `AUTO_PAYOUT_ENABLED=true`; decide on the second NAT Gateway

**Rollback** (any point, ~10 minutes): revert the registrar/DNS change — the 300s TTL is why this works — and prod goes idle with QA unaffected. If prod is already live and the fault is application-level, re-run the pipeline at the previous release SHA. If a migration is implicated, restore the pre-deploy snapshot into a new instance and repoint `DATABASE_URL`. **Prisma migrations are not automatically reversible — the snapshot is the rollback.**

---

## 8. Prisma / database connection notes

- The URL must carry `sslmode=require` once `rds.force_ssl=1` is set.
- Set `connection_limit` explicitly. Prisma's default is `num_cpus × 2 + 1` **per process**, which grows with every scale-out. Budget: `instances × api_processes × connection_limit ≤ 60%` of RDS `max_connections` (≈340 on t4g.medium).
- At >4 instances introduce **RDS Proxy** rather than buying connections by upsizing the database.
- Migrations are applied by exactly one instance per deploy. `prisma migrate deploy` takes an advisory lock so a concurrent run is safe — but it's still a bug; keep the `RUN_MIGRATIONS` flag.
- `npm run seed:pages` is safe to re-run (creates only missing slugs, preserving admin edits) — keep it in the pipeline.

---

## 9. Application changes required by this plan

| # | Change | Phase | Size |
|---|---|---|---|
| 1 | `trust proxy` via `NestExpressApplication` | P0.1 | ✅ **DONE** — commit d0af2eb |
| 2 | Redis-backed throttler storage | P0.2 | S |
| 3 | `/api/v1/health/live` (ALB) + `/api/v1/health` (deep) + `/healthz` | P0.3 | ✅ **DONE** — commit d0af2eb. Split into liveness vs readiness; see note below |
| 4 | `enableShutdownHooks()` + BullMQ drain on SIGTERM | P0.4 | ✅ **DONE** — commit d0af2eb |
| 5 | Explicit Helmet CSP directives | P0.5 | M — **critical** |
| 6 | `tls: {}` on all BullMQ connections (six, not five — verification.service.ts has its own) | P3 | ✅ **DONE** — commit d0af2eb, via `REDIS_TLS` + `buildQueueConnection()` |
| 7 | Declare any new env var in `env.validation.ts` | P5 | S |
| 8 | Confirm AWS SDK clients use the default credential chain | P5 | S |
| 9 | `deploy-prod.yml` + SSM deploy script | P8 | M |
| 10 | Install and wire Sentry (absent from both apps today) | P10 | M |

---

## 10. Codebase-specific traps

Each of these has already cost time on QA, or will cost time on launch day. They are why this document is longer than a generic AWS runbook.

0. **The API used to hang forever at boot when Redis was unreachable — FIXED 2026-08-20, commit `d0af2eb`.** Found by running the app with Redis stopped, not by reading it. Every queue's `onModuleInit` awaited `queue.add(...)` to arm its repeatable job; BullMQ *buffers* that command while disconnected, so the promise never settled — neither resolved nor rejected. The `try/catch` around it, commented as letting the API "log and continue rather than refusing to boot", could never fire, and Nest's bootstrap stalled before `app.listen()`. Invisible on QA, where Redis is on localhost and up whenever the box is. **In production this was an unrecoverable outage**: ElastiCache is a cross-AZ dependency with failovers, so any instance starting during a blip would hang forever, never pass a health check, and in an ASG replacements would never enter service. `onModuleInit` now delegates to a non-awaited `initQueue()`. **When ElastiCache is introduced in P3, re-run the Redis-down boot test before trusting the ASG.**

0b. **Nothing had `error` listeners on the BullMQ Queue/Worker objects** — an `'error'` event with no listener is an unhandled exception in Node, so an unreachable Redis produced raw `AggregateError`s. Measured 30 before, 0 after. Fixed in the same commit; note there are **six** Redis consumers, not five — `verification.service.ts` builds its own queue outside the `*.queue.ts` files.

0c. **`CacheService` had never executed, in any environment.** It reads `REDIS_URL`, which was absent from `env.validation.ts`, so Zod stripped it and the service disabled itself everywhere. Every `getOrSet` fell through to Postgres. Declaring it then exposed a second defect — its `retryStrategy` never returned `null`, so enabling it crash-looped the process. Both fixed, and the cache now sits behind `CACHE_ENABLED` (default off) so switching it on is deliberate and switching it off is an env change rather than a code deploy. See the env inventory.

1. **`/api/*` collision.** Next.js owns `/api/revalidate-static-page`. The ALB rule ordering in §P6 is load-bearing.
2. **CORS is exactly one origin in production.** `main.ts:38-41` — `www`, a trailing slash or `http://` all fail. `FRONTEND_URL` must be byte-exact.
3. **`sameSite: 'strict'` refresh cookie** (`auth.controller.ts:260`) — this is why the API cannot live on `api.spiritualcalifornia.com` (D4).
4. **Undeclared env vars vanish.** Zod's `z.object()` strips unknown keys; `@nestjs/config` exposes only validated ones.
5. **Algolia keys are required even though Algolia is off** — `min(1)` on three variables; non-empty placeholders or the API won't boot.
6. **Rate limiting collapses behind a proxy** without `trust proxy`: ten requests per second **for the entire site**, shared (P0.1).
7. **Raw-body webhook routes** are mounted by exact path in `main.ts:17-22`. Adding a webhook without its raw-body mount breaks signature verification; so does any body-rewriting proxy in front.
8. **`next build` needs devDependencies** — `unset NODE_ENV` before the frontend `npm ci`.
9. **`NEXT_PUBLIC_*` is baked at build time** — changing the Stripe publishable key requires a rebuild, not a restart.
10. **`rm -rf dist` + `test -f dist/main.js`** — stale nested build layouts have silently 502'd this app before.
11. **`pm2 restart`, never `reload --update-env`** — the flag captures the calling shell's environment and overrides dotenv with stale values.
12. **`tsconfig.build.json` exclusions** — any new top-level `.ts` outside `src/` widens `rootDir` and moves `dist/main.js`. Add it to the exclude list in the same commit.
13. **Public guide visibility is a three-flag AND** — `isVerified && isPublished && user.isActive`. On a fresh production database with Stripe Identity not yet live, **no guide is publicly visible**. Expect an empty practitioner listing until the first approval; don't debug it as a bug.
14. **BullMQ across multiple instances.** Repeatable jobs dedupe by repeat key in Redis, so cron work runs once per tick regardless of instance count — but every instance is also a worker competing for jobs. If ordering or double-execution ever looks suspect, set `*_TASKS_ENABLED=false` on all but one instance.
15. **Redis `noeviction`** — the default LRU policy silently discards queued jobs under memory pressure, including stock-hold releases and payout runs.
16. **`INVITE_EMAIL_MODE` defaults to `redirect`** — that default is a safety feature. Flipping it to `live` on a fresh domain at full volume is how a sending domain gets blocklisted on day one.
17. **Commission display reads live `CommissionRate` rows**, not the env var. Seed those rows in production or guides see the fallback.

---

## 11. Cost estimate (us-west-1, on-demand, monthly)

| Item | Launch tier | Scale tier (4 app instances, r6g.large DB) |
|---|---|---|
| ALB | $23 | $35 |
| EC2 (2 → 4 × t3.medium) | $61 | $122 |
| RDS Multi-AZ (t4g.medium → r6g.large) | $110 | $290 |
| ElastiCache (2 × t4g.micro) | $23 | $46 |
| NAT Gateway (1 → 2) | $40 | $85 |
| S3 + CloudFront | $15 | $60 |
| WAF | $12 | $25 |
| CloudWatch + logs | $15 | $35 |
| Route 53 + ACM | $2 | $2 |
| GuardDuty / Config / CloudTrail | $25 | $40 |
| Backups (RDS + AWS Backup) | $15 | $40 |
| **Total** | **≈ $340 / mo** | **≈ $780 / mo** |

Reductions if the client pushes back: a 1-year Compute Savings Plan cuts EC2 ~30%; RDS Reserved Instances ~35%. Single-AZ RDS saves ~$55/mo but **forfeits the availability objective** — not recommended. Dropping to one app instance saves $30/mo and forfeits the same. Removing the NAT Gateway by putting instances in public subnets saves $40/mo and materially weakens security — also not recommended.

QA continues to cost what it costs today; nothing here changes it.

---

## 12. Timeline

| Week | Work |
|---|---|
| **1** | P0 code prerequisites, merged and soaking on QA. P1 account foundation in parallel. |
| **2** | P2 network, P3 data, P4 storage, P5 secrets scaffold (placeholder values). |
| **3** | P6 compute/ALB/WAF, P7 DNS + ACM + Resend, P8 pipeline. First green deploy to the preview hostname. |
| **4** | P10 observability, P11 backup + restore drill, P12 security review, full regression on preview. |
| **5** | P9 live credentials, P13 cutover. Buffer for propagation and remediation. |

**≈4 weeks of engineering plus a 1-week buffer**, assuming live third-party credentials arrive by the start of week 5 and the AWS account has no quota surprises.

---

## 13. Phase 2 — after launch

Deliberately excluded from launch scope, in the order they become worthwhile:

1. **Build-once, ship-artifact.** Building on each instance is the weakest part of this design — two instances can end up with different `node_modules`, and `next build` competes with serving traffic for memory. Move to GitHub Actions build → artifact to S3 → instances download and swap. Prerequisite to any real blue/green.
2. **Containerise → ECS Fargate.** Removes instance management and makes deploys atomic. The `PROJECT_PLAN.md` end state.
3. **Infrastructure as code.** Terraform this document. Until then every step is a click that can be forgotten — and the second-account migration stays expensive.
4. **RDS Proxy** at >4 instances.
5. **Read replica** for admin reporting and analytics that will eventually contend with checkout.
6. **CloudFront in front of the ALB** for full-page edge caching and edge DDoS absorption.
7. **Second AWS account** with an Organization SCP — the real answer to the isolation constraint (§4).
8. **Sentry**, then structured JSON logging with request IDs.

---

## 14. Open decisions for the client

| # | Question | Default if no answer (proceeding on this basis) |
|---|---|---|
| 1 | Region: us-west-1 or us-west-2? | **RESOLVED 2026-08-20 — us-west-1**, same region as QA. Textract availability was verified in the client account, removing the original reason to prefer Oregon. |
| 2 | One NAT Gateway or two? | **One**, AZ-failure risk recorded, revisited at week 4 |
| 3 | Is `www` a redirect or a served host? | **Redirect to apex** — required by the CORS design |
| 4 | Does inbound email (MX) need hosting, or is the domain send-only? | **Send-only**; no MX records created |
| 5 | `AUTO_PAYOUT_ENABLED` on at launch? | **Off** until the first manual payout cycle reconciles |
| 6 | Are practitioner invites part of the launch? | **No** — `INVITE_EMAIL_MODE=redirect`, `INVITE_TASKS_ENABLED=false` |
| 7 | Two AWS accounts, if the client authorises it? | **No** — same account with the §4 five-layer isolation |

---

## 15. Related documents

- `AWS_DEPLOYMENT_PLAN.md` — the QA build (historical; do not follow for production)
- `docs/pre-launch-data-purge.md` — why production starts empty
- `docs/checkout-account-gate.md` — no guest checkout; affects the launch smoke test
- `docs/public-visibility-gate.md` — the three-flag visibility AND (trap 13)
- `docs/order-hold-expiry.md` — why `ORDER_TASKS_ENABLED` must be true
- `docs/guide-payouts-v2.1-amendment.md` — payout flags and their commercial meaning
- `docs/compliance-implementation.md` — CST seller-of-travel obligations that apply the moment tours are sellable
