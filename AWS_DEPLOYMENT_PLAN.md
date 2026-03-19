# AWS Deployment Plan
## Domain: `spiritualcalifornia.nityo.in`
## Date: 2026-03-19

---

## Architecture Overview

```
Internet
    │
    ▼
Route 53 / DNS (nityo.in nameserver)
    │
    ▼
AWS ALB  ──── SSL cert (ACM)
    │
    ├─── /api/*  ──────► EC2: NestJS (port 3001)
    │                         └── RDS PostgreSQL
    │                         └── ElastiCache Redis
    │
    └─── /*  ──────────► EC2: Next.js (port 3000)
                         └── S3 + CloudFront (static assets)
```

**Demo/Staging (current phase):** Single EC2 + RDS + Nginx (simpler, cheaper)
**Production (10k+ users):** ECS Fargate + ALB + RDS Multi-AZ (per PROJECT_PLAN.md)

---

## Things You Need From the Client (Collect Before Starting)

| Item | Where to get |
|------|-------------|
| AWS account login / access keys | Client provides |
| Domain DNS access for `nityo.in` | Client's DNS provider (GoDaddy / Cloudflare / Route 53) |
| Resend API key | resend.com dashboard |
| Google OAuth client ID + secret | Google Cloud Console → Credentials |
| GitHub repo URL (or zip) | Your choice of delivery method |
| Persona API key + webhook secret + template ID | Phase 2 pending |
| Anthropic API key | console.anthropic.com |
| AWS Textract keys (if separate from main account) | Phase 2 pending |

---

## Recommended Deployment Order

```
Day 1:  AWS setup → RDS → Redis → S3 → EC2 launch
Day 2:  DNS + SSL → Nginx config → Backend deploy + migrate
Day 3:  Frontend deploy → smoke test → PM2 startup
```

---

## Phase 1 — AWS Account Prerequisites

### 1.1 IAM Setup
```
AWS Console → IAM → Users → Create User
  Name: sc-deploy
  Permissions: AdministratorAccess (lock down after setup)
  Generate Access Keys (CLI use) → save to password manager
```

### 1.2 Region
Use **us-west-1** (N. California) — fits the brand and user base proximity.

### 1.3 Verify Service Limits
Confirm the account can launch t3 instances (new accounts sometimes have limits).

---

## Phase 2 — Networking (Security Groups)

Use the **default VPC** for demo. Custom VPC with public/private subnets for production.

### Security Groups to Create

**sg-sc-alb** (Nginx ingress):
| Type | Port | Source |
|------|------|--------|
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |

**sg-sc-app** (EC2 App Server):
| Type | Port | Source |
|------|------|--------|
| Custom TCP | 3000 | sg-sc-alb |
| Custom TCP | 3001 | sg-sc-alb |
| SSH | 22 | Your office IP only |

**sg-sc-rds** (Database):
| Type | Port | Source |
|------|------|--------|
| PostgreSQL | 5432 | sg-sc-app |

**sg-sc-redis** (Cache):
| Type | Port | Source |
|------|------|--------|
| Custom TCP | 6379 | sg-sc-app |

---

## Phase 3 — Database (RDS PostgreSQL)

```
AWS Console → RDS → Create Database
  Engine: PostgreSQL 16
  Template: Free tier (demo) / Production (prod)
  DB Instance: db.t3.micro (demo) → db.t3.medium (prod)

  Settings:
    DB identifier: sc-postgres
    Master username: scadmin
    Master password: [strong password — save it]

  Connectivity:
    VPC: default
    Security group: sg-sc-rds
    Public access: No
    Availability zone: us-west-1a

  Additional config:
    Initial DB name: spiritual_california
    Backup retention: 7 days
    Enable deletion protection: Yes (prod)
```

After creation, note the endpoint:
```
sc-postgres.xxxxxxxxxx.us-west-1.rds.amazonaws.com:5432
```

---

## Phase 4 — Redis (ElastiCache)

```
AWS Console → ElastiCache → Create cluster
  Cluster mode: Disabled (single node for demo)
  Engine: Redis 7
  Node type: cache.t3.micro

  Security group: sg-sc-redis
  Subnet group: default
```

Note the endpoint:
```
sc-redis.xxxxxx.ng.0001.usw1.cache.amazonaws.com:6379
```

---

## Phase 5 — S3 Bucket (File Storage)

```
AWS Console → S3 → Create bucket
  Name: sc-uploads-prod   (must be globally unique)
  Region: us-west-1
  Block all public access: Yes   (files served via pre-signed URLs)
  Versioning: Enable
```

CORS policy (for direct browser uploads):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://spiritualcalifornia.nityo.in"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Create IAM user for app S3 access:
```
IAM → Users → sc-app-s3
Attach policy: AmazonS3FullAccess (scope to bucket only in prod)
Generate access keys → save for .env
```

---

## Phase 6 — EC2 App Server

```
AWS Console → EC2 → Launch Instance
  Name: sc-app-server
  AMI: Ubuntu 24.04 LTS (HVM, SSD)
  Instance type: t3.medium (2 vCPU, 4GB RAM)
  Key pair: Create new → sc-keypair → download .pem
  Security group: sg-sc-app
  Storage: 30GB gp3
```

User Data (bootstrap script — paste in Advanced section):
```bash
#!/bin/bash
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx git curl

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# PM2
npm install -g pm2

# Enable nginx
systemctl enable nginx
systemctl start nginx
```

After launch: **allocate an Elastic IP** and associate it with the instance (static IP).

SSH access:
```bash
ssh -i sc-keypair.pem ubuntu@[ELASTIC_IP]
```

---

## Phase 7 — SSL Certificate + DNS

### 7.1 Point DNS
In the `nityo.in` DNS manager (GoDaddy / Cloudflare / Route 53):

```
Type: A
Name: spiritualcalifornia
Value: [EC2 Elastic IP]
TTL: 300
```

Wait 5–30 minutes. Verify:
```bash
nslookup spiritualcalifornia.nityo.in
```

### 7.2 SSL via Let's Encrypt (free)
```bash
sudo certbot --nginx -d spiritualcalifornia.nityo.in
# Enter email, agree to ToS, choose option 2 (redirect HTTP → HTTPS)

# Verify auto-renew works
sudo certbot renew --dry-run
```

---

## Phase 8 — Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/spiritualcalifornia
```

```nginx
server {
    listen 80;
    server_name spiritualcalifornia.nityo.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name spiritualcalifornia.nityo.in;

    ssl_certificate /etc/letsencrypt/live/spiritualcalifornia.nityo.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spiritualcalifornia.nityo.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ── API: /api/* → NestJS on port 3001 ──────────────────────────
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        client_max_body_size 20M;
    }

    # ── Frontend: /* → Next.js on port 3000 ────────────────────────
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and reload:
```bash
sudo ln -s /etc/nginx/sites-available/spiritualcalifornia /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Phase 9 — Deploy the Backend (NestJS)

### 9.1 Copy code to EC2

Option A — Git (recommended):
```bash
cd /var/www
sudo mkdir spiritual-california && sudo chown ubuntu:ubuntu spiritual-california
cd spiritual-california
git clone [YOUR_GITHUB_REPO_URL] .
```

Option B — SCP from Windows:
```bash
scp -i sc-keypair.pem -r \
  "d:/Development/htdocs/Spiritual_California_Marketplace_Platform/Backend/api" \
  ubuntu@[ELASTIC_IP]:/var/www/spiritual-california/api
```

### 9.2 Backend `.env`

```bash
nano /var/www/spiritual-california/api/.env
```

```env
# Database
DATABASE_URL="postgresql://scadmin:[PASSWORD]@sc-postgres.xxxxxxxxxx.us-west-1.rds.amazonaws.com:5432/spiritual_california?schema=public"

# Redis
REDIS_URL="redis://sc-redis.xxxxxx.ng.0001.usw1.cache.amazonaws.com:6379"

# App
NODE_ENV=production
PORT=3001
API_PREFIX=

# JWT
JWT_SECRET=[64-char random — run: openssl rand -hex 32]
JWT_REFRESH_SECRET=[different 64-char string]
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Frontend URL (for CORS)
FRONTEND_URL=https://spiritualcalifornia.nityo.in

# AWS S3
AWS_ACCESS_KEY_ID=[sc-app-s3 key]
AWS_SECRET_ACCESS_KEY=[sc-app-s3 secret]
AWS_REGION=us-west-1
AWS_S3_BUCKET=sc-uploads-prod

# Email (Resend)
RESEND_API_KEY=[from resend.com dashboard]
EMAIL_FROM=noreply@spiritualcalifornia.com
SUPPORT_EMAIL=support@spiritualcalifornia.com

# Google OAuth
GOOGLE_CLIENT_ID=[from Google Cloud Console]
GOOGLE_CLIENT_SECRET=[from Google Cloud Console]
GOOGLE_CALLBACK_URL=https://spiritualcalifornia.nityo.in/api/auth/google/callback

# Stub keys — replace when received from stakeholders
PERSONA_API_KEY=placeholder
PERSONA_WEBHOOK_SECRET=placeholder
PERSONA_TEMPLATE_ID=placeholder
ANTHROPIC_API_KEY=placeholder
```

### 9.3 Build and Migrate

```bash
cd /var/www/spiritual-california/api
npm ci --production=false
npm run build
npx prisma migrate deploy
# npx prisma db seed   # uncomment if seed file is ready
```

### 9.4 Start with PM2

```bash
pm2 start dist/main.js --name "sc-api" --env production
pm2 save
pm2 startup   # copy and run the printed command
```

---

## Phase 10 — Deploy the Frontend (Next.js)

### 10.1 Copy code to EC2

Option A — Git:
```bash
# already cloned in /var/www/spiritual-california — cd into web folder
```

Option B — SCP:
```bash
scp -i sc-keypair.pem -r \
  "d:/Development/htdocs/Spiritual_California_Marketplace_Platform/Frontend/web" \
  ubuntu@[ELASTIC_IP]:/var/www/spiritual-california/web
```

### 10.2 Frontend `.env.local`

```bash
nano /var/www/spiritual-california/web/.env.local
```

```env
# Inlined at build time (visible in browser)
NEXT_PUBLIC_API_URL=https://spiritualcalifornia.nityo.in/api
NEXT_PUBLIC_APP_URL=https://spiritualcalifornia.nityo.in

# Server-side only
NEXTAUTH_SECRET=[32-char random string]
```

### 10.3 Build and Start

```bash
cd /var/www/spiritual-california/web
npm ci
npm run build
pm2 start npm --name "sc-web" -- start -- -p 3000
pm2 save
```

---

## Phase 11 — Smoke Test Checklist

```bash
# Both processes running
pm2 status

# API health check
curl http://localhost:3001/health
curl https://spiritualcalifornia.nityo.in/api/health

# Frontend responds
curl -I https://spiritualcalifornia.nityo.in

# Live logs
pm2 logs sc-api --lines 50
pm2 logs sc-web --lines 50
```

Manual browser tests:
- [ ] Home page loads at `https://spiritualcalifornia.nityo.in`
- [ ] SSL padlock is green
- [ ] Seeker registration flow works
- [ ] Guide onboarding wizard works
- [ ] Admin panel login at `/login`
- [ ] Contact form submits and confirmation email arrives
- [ ] `/about`, `/mission`, `/contact` pages load

---

## Phase 12 — Ongoing Deploy Script

Create `/var/www/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "=== Deploying API ==="
cd /var/www/spiritual-california/api
git pull
npm ci --production=false
npm run build
npx prisma migrate deploy
pm2 restart sc-api

echo "=== Deploying Web ==="
cd /var/www/spiritual-california/web
git pull
npm ci
npm run build
pm2 restart sc-web

echo "=== Deploy complete ==="
pm2 status
```

```bash
chmod +x /var/www/deploy.sh
# To redeploy: bash /var/www/deploy.sh
```

---

## Cost Estimate (Demo/Staging)

| Service | Spec | Est. Monthly |
|---------|------|-------------|
| EC2 t3.medium | 2 vCPU / 4GB RAM | ~$30 |
| RDS db.t3.micro | PostgreSQL 16 | ~$15 |
| ElastiCache cache.t3.micro | Redis 7 | ~$12 |
| S3 | First 5GB free | ~$1 |
| Data transfer | ~10GB | ~$1 |
| **Total** | | **~$60/month** |

---

## Notes

- All stub API keys (Persona, Anthropic, Textract) log `[STUB]` prefix — search backend for `[STUB]` to find all integration points when real keys arrive.
- Google OAuth callback URL must be registered in Google Cloud Console → APIs & Services → Credentials → Authorized redirect URIs.
- Resend requires domain verification for the `FROM` email address — verify `spiritualcalifornia.com` in Resend dashboard or use their sandbox for testing.
- For production scale (ECS Fargate + ALB), refer to PROJECT_PLAN.md Phase 9 (Security + Performance).
