#!/usr/bin/env bash
#
# Runs ON a production instance, delivered by SSM SendCommand from the
# GitHub Actions workflow. Never run by hand except for a deliberate
# recovery.
#
# Every hardening line here was earned on the QA pipeline. See
# docs/production-deployment-plan.md §P8 and the deploy-pipeline-hardening
# notes — each one exists because its absence silently broke a deploy once.
#
set -euo pipefail

REGION="${REGION:-us-west-1}"
APP_DIR="${APP_DIR:-/var/www/spiritual-california}"
TARGET_SHA="${TARGET_SHA:?TARGET_SHA is required}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-false}"
REPO="${REPO:-vinayjais81/spiritualcalifornia_devcode_2026}"

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

log "target ${TARGET_SHA}, migrations=${RUN_MIGRATIONS}"

# ── 1. Configuration from Parameter Store ────────────────────────────────────
#
# Pulled fresh on every deploy rather than baked into an AMI, so a config
# change is an SSM edit plus a restart — and so a replacement instance comes
# up with current configuration rather than whatever was true at image time.
log "fetching configuration"
mkdir -p "${APP_DIR}"

GH_TOKEN=$(aws ssm get-parameter --region "$REGION" \
  --name /sc/prod/github/token --with-decryption \
  --query Parameter.Value --output text)

# ── 2. Source code ───────────────────────────────────────────────────────────
#
# The token is written to a file with 0600 rather than embedded in the remote
# URL: a URL containing credentials is persisted in .git/config and printed
# in any error message git emits.
git config --global credential.helper "store --file=${HOME}/.git-credentials"
printf 'https://x-access-token:%s@github.com\n' "$GH_TOKEN" > "${HOME}/.git-credentials"
chmod 600 "${HOME}/.git-credentials"

if [ ! -d "${APP_DIR}/.git" ]; then
  log "first deploy — cloning"
  git clone "https://github.com/${REPO}.git" "${APP_DIR}"
fi

cd "${APP_DIR}"
git fetch --all --prune
# A pinned SHA, never a moving branch ref: two instances deploying minutes
# apart must land on identical code.
git reset --hard "${TARGET_SHA}"
git clean -fd -e node_modules -e .env -e .env.local

# Remove the credential as soon as it is no longer needed. It lives in
# Parameter Store; there is no reason for a copy to persist on disk.
rm -f "${HOME}/.git-credentials"
git config --global --unset credential.helper || true

# ── 3. RDS CA bundle ─────────────────────────────────────────────────────────
#
# RDS certificates are signed by the Amazon RDS root CA, which is not in
# Node's trust store, so node-postgres rejects the connection with
# "self-signed certificate in certificate chain". Handing it the bundle lets
# verification stay ON rather than being switched off to make the error go
# away — see Backend/api/src/common/db-ssl.ts.
#
# The bundle is a public certificate, refreshed here on every deploy so a CA
# rotation does not require a rebuild.
CA_PATH="${APP_DIR}/rds-ca-bundle.pem"
log "fetching RDS CA bundle"
curl -fsSL --retry 3 -o "${CA_PATH}.tmp" \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
# Only replace a working bundle if the download actually looks like one.
grep -q "BEGIN CERTIFICATE" "${CA_PATH}.tmp" || { log "ERROR: CA bundle download looks wrong"; exit 1; }
mv "${CA_PATH}.tmp" "${CA_PATH}"

# ── 4. Environment files ─────────────────────────────────────────────────────
log "writing env files"
aws ssm get-parameter --region "$REGION" --name /sc/prod/api/dotenv --with-decryption \
  --query Parameter.Value --output text > Backend/api/.env
aws ssm get-parameter --region "$REGION" --name /sc/prod/web/dotenv --with-decryption \
  --query Parameter.Value --output text > Frontend/web/.env.local
chmod 600 Backend/api/.env Frontend/web/.env.local

# Point the app at the bundle fetched above. Appended rather than expected in
# the stored config, because the path is a property of THIS host's layout,
# not of the environment's configuration.
echo "DATABASE_CA_CERT_PATH=${CA_PATH}" >> Backend/api/.env

# ── 4. Backend ───────────────────────────────────────────────────────────────
log "building backend"
cd "${APP_DIR}/Backend/api"
npm ci
npx prisma generate

if [ "$RUN_MIGRATIONS" = "true" ]; then
  log "running migrations"
  npx prisma migrate status || true
  npx prisma migrate deploy
fi

# Idempotent: creates only slugs that do not exist, so admin edits survive.
npm run seed:pages

# Wipe before building. A stale nested dist/ layout from an earlier tsconfig
# has silently 502'd this app before — the old files stay servable and the
# process starts against the wrong entrypoint.
rm -rf dist
npm run build

# Fail loudly rather than swapping PM2 onto a broken build. Without this a
# TypeScript layout regression produces a green deploy and a crash-looping
# process.
test -f dist/main.js || { log "ERROR: dist/main.js missing after build"; ls -la dist; exit 1; }

# ── 5. Frontend ──────────────────────────────────────────────────────────────
log "building frontend"
cd "${APP_DIR}/Frontend/web"

# NODE_ENV=production makes npm ci skip devDependencies, and next build needs
# them. Unset it for the install and build only.
unset NODE_ENV
npm ci
rm -rf .next
npm run build

# ── 6. Process swap ──────────────────────────────────────────────────────────
#
# restart, never `reload --update-env`: that flag injects the CALLING shell's
# environment into PM2, which can override the values dotenv just read from
# the files written above.
log "swapping processes"
cd "${APP_DIR}"

if pm2 describe sc-api > /dev/null 2>&1; then
  pm2 restart sc-api
else
  pm2 start "${APP_DIR}/Backend/api/dist/main.js" --name sc-api
fi

if pm2 describe sc-web > /dev/null 2>&1; then
  pm2 restart sc-web
else
  pm2 start npm --name sc-web --cwd "${APP_DIR}/Frontend/web" -- start
fi

pm2 save

# ── 7. Local gate ────────────────────────────────────────────────────────────
#
# Verified here, before the load balancer is allowed to send traffic back.
# Checking only from outside would mean a broken instance is discovered by
# users rather than by the pipeline.
log "waiting for health"
for i in $(seq 1 45); do
  if curl -fsS http://localhost:3001/api/v1/health/live > /dev/null 2>&1 \
     && curl -fsS http://localhost:3000/healthz > /dev/null 2>&1; then
    log "healthy after $((i * 2))s"

    # Deep check is informational: a failing dependency is worth surfacing in
    # the deploy log, but it is not this instance's fault and should not fail
    # the deploy.
    log "readiness: $(curl -s http://localhost:3001/api/v1/health || echo unavailable)"
    exit 0
  fi
  sleep 2
done

log "ERROR: health check never passed"
pm2 logs sc-api --lines 40 --nostream || true
pm2 logs sc-web --lines 40 --nostream || true
exit 1
