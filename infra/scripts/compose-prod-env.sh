#!/usr/bin/env bash
#
# Compose /sc/prod/api/dotenv and /sc/prod/web/dotenv from authoritative
# sources, and upload them.
#
# WHY THIS EXISTS
# ---------------
# Composing these by hand means retyping a database password into a
# connection string, a Redis token into two places, and a shared secret into
# two different files. Every one of those is a chance to produce a value that
# is wrong in a way no error message points at: a missing colon in a URL
# fails Zod validation at boot with a message about CloudFront; a mismatched
# revalidation secret makes CMS publishing 401 silently. Both happened.
#
# SAFE TO RE-RUN
# --------------
# Existing generated secrets and any real third-party keys are CARRIED
# FORWARD, never regenerated. Re-running does not sign every user out and
# does not overwrite live Stripe keys with placeholders — which is what makes
# this usable again at go-live rather than only once.
#
# Usage:
#   ./compose-prod-env.sh              # write files locally, print a summary
#   ./compose-prod-env.sh --upload     # ...and put them in Parameter Store
#
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows mangles /sc/... into a path

REGION="us-west-1"
EXPECTED_ACCOUNT="372110294387"
SITE_URL="https://spiritualcalifornia.com"
UPLOAD=0
[[ "${1:-}" == "--upload" ]] && UPLOAD=1

OUT_DIR="$(mktemp -d)"
API_FILE="${OUT_DIR}/api.env"
WEB_FILE="${OUT_DIR}/web.env"

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
[[ "$ACCOUNT" == "$EXPECTED_ACCOUNT" ]] || { echo "ERROR: wrong account ($ACCOUNT)" >&2; exit 1; }

ssm_get() {
  aws ssm get-parameter --region "$REGION" --name "$1" --with-decryption \
    --query Parameter.Value --output text 2>/dev/null || echo ""
}

# Pull the current api dotenv so existing values can be preserved.
EXISTING=$(ssm_get /sc/prod/api/dotenv)
EXISTING_WEB=$(ssm_get /sc/prod/web/dotenv)

# Read one key out of an env blob. Trims CR, which Notepad-authored files carry.
#
# The trailing `|| true` matters: grep exits 1 when the key is absent, and with
# `set -e` plus `pipefail` that aborts the whole script — silently, because the
# failure is inside a command substitution and prints nothing. Every key that
# already existed masked this; the first genuinely NEW variable hit it.
from_existing() {
  echo "${1:-}" | grep -E "^$2=" | head -1 | cut -d= -f2- | tr -d '\r' || true
}

# Keep the old value unless it is empty or still a placeholder.
keep_or() {
  local current="$1" fallback="$2"
  if [[ -z "$current" || "$current" == PLACEHOLDER* || "$current" == PASTE_* || "$current" == REPLACE_* || "$current" == SEE_* ]]; then
    echo "$fallback"
  else
    echo "$current"
  fi
}

rand_hex() { openssl rand -hex 32; }

echo "Reading infrastructure values..."
RDS_ENDPOINT=$(ssm_get /sc/prod/rds/endpoint)
DB_PASSWORD=$(ssm_get /sc/prod/rds/app-password)
REDIS_ENDPOINT=$(ssm_get /sc/prod/redis/endpoint)
REDIS_TOKEN=$(ssm_get /sc/prod/redis/auth-token)

S3_BUCKET="sc-prod-uploads-${EXPECTED_ACCOUNT}"
CF_DOMAIN=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='Spiritual California production uploads'].DomainName | [0]" \
  --output text)
ALB_DNS=$(aws elbv2 describe-load-balancers --region "$REGION" --names sc-prod-alb \
  --query "LoadBalancers[0].DNSName" --output text 2>/dev/null || echo "")

for v in RDS_ENDPOINT DB_PASSWORD REDIS_ENDPOINT REDIS_TOKEN CF_DOMAIN; do
  [[ -n "${!v}" && "${!v}" != "None" ]] || { echo "ERROR: $v is empty. Has the stack been applied?" >&2; exit 1; }
done

echo "Preserving existing secrets where present..."
JWT_ACCESS=$(keep_or "$(from_existing "$EXISTING" JWT_ACCESS_SECRET)" "$(rand_hex)")
JWT_REFRESH=$(keep_or "$(from_existing "$EXISTING" JWT_REFRESH_SECRET)" "$(rand_hex)")
EMAIL_HASH=$(keep_or "$(from_existing "$EXISTING" EMAIL_HASH_SECRET)" "$(rand_hex)")
REVALIDATE=$(keep_or "$(from_existing "$EXISTING" STATIC_PAGE_REVALIDATE_SECRET)" "$(rand_hex)")

[[ "$JWT_ACCESS" != "$JWT_REFRESH" ]] || { echo "ERROR: JWT access and refresh secrets are identical" >&2; exit 1; }

# ── Passport encryption key: generate once, then never lose it ───────────────
#
# Unlike the JWT secrets, regenerating this one DESTROYS DATA. It encrypts
# stored passport numbers with AES-256-GCM; a different key fails
# authentication rather than returning garbage, so every existing record
# becomes permanently unreadable. No rotation handler exists yet.
#
# keep_or already carries the existing value forward, which is what matters —
# but the extra guard below makes the consequence explicit rather than relying
# on that being remembered.
PASSPORT_KEY=$(keep_or "$(from_existing "$EXISTING" PASSPORT_ENCRYPTION_KEY)" "$(rand_hex)")

if [[ ! "$PASSPORT_KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "ERROR: PASSPORT_ENCRYPTION_KEY is not 64 hex characters. Refusing to write a key that cannot decrypt existing passports." >&2
  exit 1
fi

EXISTING_PASSPORT=$(from_existing "$EXISTING" PASSPORT_ENCRYPTION_KEY)
if [[ -n "$EXISTING_PASSPORT" && "$EXISTING_PASSPORT" != "$PASSPORT_KEY" ]]; then
  echo "ERROR: refusing to replace an existing PASSPORT_ENCRYPTION_KEY - stored passports would become undecryptable." >&2
  exit 1
fi

# Third-party keys: preserved if real, placeholder otherwise. This is what
# lets the script run again at go-live without clobbering live credentials.
keep_third_party() { keep_or "$(from_existing "$EXISTING" "$1")" "PLACEHOLDER"; }

STRIPE_SECRET=$(keep_third_party STRIPE_SECRET_KEY)
STRIPE_WEBHOOK=$(keep_third_party STRIPE_WEBHOOK_SECRET)
STRIPE_IDENTITY=$(keep_third_party STRIPE_IDENTITY_WEBHOOK_SECRET)
RESEND_KEY=$(keep_third_party RESEND_API_KEY)

# STRIPE_CONNECT_WEBHOOK_SECRET is deliberately NOT a keep_third_party key.
#
# Stripe splits "events on your account" from "events on connected accounts",
# and both endpoints can point at the same URL with DIFFERENT signing secrets.
# On 2026-08-27 a Connect endpoint (application=ca_...) was added for
# `account.updated`; its secret never reached this config, so every delivery
# failed signature verification with a 400 and Stripe threatened to disable
# the endpoint. This script was part of that: it had no slot for the variable
# at all, so even a correct manual fix would be erased on the next run.
#
# It stays optional rather than defaulting to PLACEHOLDER because the code
# branches on presence (`if (!connect) throw err` in stripe.service.ts) — an
# unset variable reports the real primary-secret failure, while a placeholder
# would report a bogus second failure and misdirect the next investigation.
STRIPE_CONNECT_WEBHOOK=$(from_existing "$EXISTING" STRIPE_CONNECT_WEBHOOK_SECRET)
if [[ -n "$STRIPE_CONNECT_WEBHOOK" && "$STRIPE_CONNECT_WEBHOOK" != PLACEHOLDER* ]]; then
  STRIPE_CONNECT_LINE="STRIPE_CONNECT_WEBHOOK_SECRET=${STRIPE_CONNECT_WEBHOOK}"
else
  STRIPE_CONNECT_LINE="# STRIPE_CONNECT_WEBHOOK_SECRET unset - required only if Stripe issued a
# second (Connect) endpoint for the same webhook URL. Set it with:
#   bash infra/scripts/set-prod-env-var.sh api STRIPE_CONNECT_WEBHOOK_SECRET"
fi
ANTHROPIC_KEY=$(keep_third_party ANTHROPIC_API_KEY)
ZOOM_ACCOUNT=$(keep_third_party ZOOM_ACCOUNT_ID)
ZOOM_CLIENT=$(keep_third_party ZOOM_CLIENT_ID)
ZOOM_SECRET=$(keep_third_party ZOOM_CLIENT_SECRET)
CALENDLY_ID=$(keep_third_party CALENDLY_CLIENT_ID)
CALENDLY_SECRET=$(keep_third_party CALENDLY_CLIENT_SECRET)
CALENDLY_WEBHOOK=$(keep_third_party CALENDLY_WEBHOOK_SECRET)
GOOGLE_ID=$(keep_third_party GOOGLE_CLIENT_ID)
GOOGLE_SECRET=$(keep_third_party GOOGLE_CLIENT_SECRET)
STRIPE_PUB=$(keep_or "$(from_existing "$EXISTING_WEB" NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)" "PLACEHOLDER")

# Before DNS cutover the frontend must call the API by the ALB name; the real
# domain does not resolve yet. NEXT_PUBLIC_* is baked in at BUILD time, so
# changing this later needs a rebuild, not a restart.
API_BASE="${SITE_URL}/api/v1"
if [[ -n "$ALB_DNS" && "${USE_ALB:-1}" == "1" ]]; then
  API_BASE="http://${ALB_DNS}/api/v1"
fi

echo "Writing files..."

# NOTE: pure ASCII only. Non-ASCII in a Parameter Store value cannot be read
# back through the AWS CLI on a Windows console - it fails mid-stream and the
# shell redirect silently produces an empty file.
cat > "$API_FILE" <<EOF
# Generated by compose-prod-env.sh. Do not hand-edit in Parameter Store;
# re-run the script instead, which preserves secrets and real keys.

NODE_ENV=production
PORT=3001
FRONTEND_URL=${SITE_URL}
TRUST_PROXY_HOPS=1

# sslmode=require is mandatory - rds.force_ssl=1 rejects plaintext.
# Pool size comes from DATABASE_POOL_MAX; @prisma/adapter-pg never reads
# connection_limit from the URL.
DATABASE_URL=postgresql://sc_app:${DB_PASSWORD}@${RDS_ENDPOINT}/spiritual_california?schema=public&sslmode=require
DATABASE_POOL_MAX=10

REDIS_HOST=${REDIS_ENDPOINT}
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_TOKEN}
REDIS_TLS=true
# rediss:// - two s, because in-transit encryption is on.
REDIS_URL=rediss://:${REDIS_TOKEN}@${REDIS_ENDPOINT}:6379
# The cache has never run in any environment; leave false until its
# invalidation has been watched under real traffic.
CACHE_ENABLED=false

AWS_REGION=${REGION}
AWS_S3_BUCKET=${S3_BUCKET}
AWS_CLOUDFRONT_URL=https://${CF_DOMAIN}
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are deliberately ABSENT.
# Production authenticates with the EC2 instance role, and a placeholder
# here would be used by the SDK instead of falling back to it.

JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d
EMAIL_HASH_SECRET=${EMAIL_HASH}
STATIC_PAGE_REVALIDATE_SECRET=${REVALIDATE}

# Passport PII encryption (AES-256-GCM), for Soul Tour bookings.
# DO NOT REGENERATE. A new key cannot decrypt existing passport records -
# GCM fails authentication rather than returning garbage, and no rotation
# handler exists. Generated once and carried forward on every run.
PASSPORT_ENCRYPTION_KEY=${PASSPORT_KEY}

STRIPE_SECRET_KEY=${STRIPE_SECRET}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK}
STRIPE_IDENTITY_WEBHOOK_SECRET=${STRIPE_IDENTITY}
${STRIPE_CONNECT_LINE}
STRIPE_PLATFORM_COMMISSION_PERCENT=20

RESEND_API_KEY=${RESEND_KEY}
EMAIL_FROM=noreply@spiritualcalifornia.com
SUPPORT_EMAIL=support@spiritualcalifornia.com

# Required by the schema even though search runs on Postgres FTS.
ALGOLIA_APP_ID=disabled
ALGOLIA_ADMIN_API_KEY=disabled
ALGOLIA_SEARCH_API_KEY=disabled
ALGOLIA_ENABLED=false

ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
ANTHROPIC_MODEL=claude-sonnet-4-6

ZOOM_ACCOUNT_ID=${ZOOM_ACCOUNT}
ZOOM_CLIENT_ID=${ZOOM_CLIENT}
ZOOM_CLIENT_SECRET=${ZOOM_SECRET}

CALENDLY_CLIENT_ID=${CALENDLY_ID}
CALENDLY_CLIENT_SECRET=${CALENDLY_SECRET}
CALENDLY_WEBHOOK_SECRET=${CALENDLY_WEBHOOK}
CALENDLY_REDIRECT_URI=${SITE_URL}/api/v1/calendly/callback

GOOGLE_CLIENT_ID=${GOOGLE_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_SECRET}
GOOGLE_CALLBACK_URL=${SITE_URL}/api/v1/auth/google/callback

LEDGER_V2_ENABLED=true
# Never auto-sweep real money before the first manual cycle reconciles.
AUTO_PAYOUT_ENABLED=false
PAYOUTS_TASKS_ENABLED=true
ORDER_TASKS_ENABLED=true
TOUR_TASKS_ENABLED=true
MIN_PAYOUT_USD=100

# Defaults to redirect in code so a fresh environment cannot mass-mail real
# practitioners. Going live is an explicit act.
INVITE_EMAIL_MODE=redirect
INVITE_TASKS_ENABLED=false
INVITE_SEND_PER_DAY=25

TEST_ACCOUNT_EMAIL_DOMAIN=scprelaunch.test
EOF

cat > "$WEB_FILE" <<EOF
# Generated by compose-prod-env.sh.
# NEXT_PUBLIC_* values are inlined at BUILD time - changing one requires a
# rebuild, not a restart.

NEXT_PUBLIC_API_URL=${API_BASE}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PUB}
NEXT_PUBLIC_ALGOLIA_APP_ID=disabled
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=disabled
NEXT_PUBLIC_ALGOLIA_GUIDES_INDEX=guides
NEXT_PUBLIC_ALGOLIA_PRODUCTS_INDEX=products

# MUST be byte-identical to the API's value, or CMS revalidation 401s
# silently and admin edits stop publishing.
STATIC_PAGE_REVALIDATE_SECRET=${REVALIDATE}
EOF

# ── Self-check ───────────────────────────────────────────────────────────────
# Catch the mistakes hand-editing produced, before they reach the deploy.
fail=0
grep -qE '^AWS_CLOUDFRONT_URL=https://[a-z0-9]+\.cloudfront\.net$' "$API_FILE" || { echo "FAIL: CloudFront URL malformed"; fail=1; }
grep -qE '^DATABASE_URL=postgresql://sc_app:[^@]+@[^/]+/spiritual_california\?' "$API_FILE" || { echo "FAIL: DATABASE_URL malformed"; fail=1; }
grep -qE '^REDIS_URL=rediss://:[^@]+@' "$API_FILE" || { echo "FAIL: REDIS_URL malformed"; fail=1; }
[[ "$(grep '^STATIC_PAGE_REVALIDATE_SECRET=' "$API_FILE")" == "$(grep '^STATIC_PAGE_REVALIDATE_SECRET=' "$WEB_FILE")" ]] || { echo "FAIL: revalidate secrets differ"; fail=1; }
grep -q '^AWS_ACCESS_KEY_ID=' "$API_FILE" && { echo "FAIL: AWS keys must be absent (instance role)"; fail=1; }
grep -qE '^PASSPORT_ENCRYPTION_KEY=[0-9a-fA-F]{64}$' "$API_FILE" || { echo "FAIL: PASSPORT_ENCRYPTION_KEY is not 64 hex chars"; fail=1; }
LC_ALL=C grep -q '[^ -~]' "$API_FILE" && { echo "FAIL: non-ASCII would be unreadable via the Windows CLI"; fail=1; }
grep -qE '= ' "$WEB_FILE" && { echo "FAIL: stray ' = ' in web env"; fail=1; }
[[ $fail -eq 0 ]] || { echo; echo "Self-check failed. Nothing uploaded."; exit 1; }

echo
echo "Self-check passed."
echo "  API vars : $(grep -cE '^[A-Z_]+=' "$API_FILE")"
echo "  Web vars : $(grep -cE '^[A-Z_]+=' "$WEB_FILE")"
echo "  API base : ${API_BASE}"
echo "  Still placeholder: $(grep -cE '=PLACEHOLDER$' "$API_FILE" "$WEB_FILE" | awk -F: '{s+=$2} END {print s}') third-party keys"
echo

if [[ $UPLOAD -eq 1 ]]; then
  echo "Uploading to Parameter Store..."
  # Content is passed inline rather than as file://. Under Git Bash on
  # Windows the AWS CLI is a native binary that cannot resolve the shell's
  # /tmp/... paths, so file:// fails with "No such file or directory" for a
  # file that plainly exists. These blobs are a few KB, well inside the
  # command-line limit.
  aws ssm put-parameter --region "$REGION" --name /sc/prod/api/dotenv \
    --type SecureString --tier Advanced --value "$(cat "$API_FILE")" --overwrite >/dev/null
  aws ssm put-parameter --region "$REGION" --name /sc/prod/web/dotenv \
    --type SecureString --value "$(cat "$WEB_FILE")" --overwrite >/dev/null
  echo "Uploaded."
else
  echo "Files written to: ${OUT_DIR}"
  echo "Review, then re-run with --upload"
fi

# Never leave secrets in a temp directory after an upload.
[[ $UPLOAD -eq 1 ]] && rm -rf "$OUT_DIR"
exit 0
