/**
 * Connection details written to SSM Parameter Store.
 *
 * These are INPUTS for the operator, not the application's configuration.
 * The app reads one blob — /sc/prod/api/dotenv — which a human composes and
 * edits (decision D7). These parameters exist so that composing it does not
 * require reading Terraform state or the AWS console.
 *
 * Parameter Store Standard tier is free. SecureString encrypts with the
 * account's SSM key by default, which is sufficient here: the isolation that
 * matters is the IAM path scoping (/sc/prod/*), which the deploy role and
 * instance profile are already restricted to.
 */

resource "aws_ssm_parameter" "db_master_password" {
  name        = "/sc/prod/rds/master-password"
  description = "RDS master password. The APP does not use this — see the sc_app user in bootstrap-db.sql."
  type        = "SecureString"
  value       = random_password.db_master.result

  tags = { Name = "sc-prod-rds-master-password" }
}

resource "aws_ssm_parameter" "db_endpoint" {
  name        = "/sc/prod/rds/endpoint"
  description = "RDS endpoint host:port."
  type        = "String"
  value       = aws_db_instance.main.endpoint

  tags = { Name = "sc-prod-rds-endpoint" }
}

resource "aws_ssm_parameter" "redis_endpoint" {
  name        = "/sc/prod/redis/endpoint"
  description = "ElastiCache primary endpoint. Use with REDIS_HOST/REDIS_PORT."
  type        = "String"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address

  tags = { Name = "sc-prod-redis-endpoint" }
}

resource "aws_ssm_parameter" "redis_auth_token" {
  count = var.redis_transit_encryption ? 1 : 0

  name        = "/sc/prod/redis/auth-token"
  description = "ElastiCache AUTH token. Becomes REDIS_PASSWORD, and the password in the rediss:// REDIS_URL."
  type        = "SecureString"
  value       = random_password.redis_auth.result

  tags = { Name = "sc-prod-redis-auth-token" }
}

/**
 * A template for the operator, NOT the live configuration.
 *
 * Deliberately holds placeholders rather than real values for anything the
 * operator supplies (Stripe, Resend, JWT secrets). Writing real secrets here
 * would put them in Terraform state, and the whole point of D7 is that live
 * credentials are entered by a human into one encrypted parameter.
 *
 * The infrastructure-derived values ARE filled in, because Terraform already
 * knows them and retyping an RDS endpoint by hand is how typos reach
 * production.
 */
resource "aws_ssm_parameter" "api_dotenv_template" {
  name        = "/sc/prod/api/dotenv-template"
  description = "Starting point for /sc/prod/api/dotenv. Copy, fill in the PLACEHOLDER values, save as the real parameter."
  type        = "SecureString"
  tier        = "Advanced" # the template exceeds the 4 KB Standard limit

  value = <<-EOT
    # ── Composed by Terraform ────────────────────────────────────────────
    NODE_ENV=production
    PORT=3001
    FRONTEND_URL=https://spiritualcalifornia.com

    # sslmode=require is mandatory: rds.force_ssl=1 rejects plaintext.
    # Pool size is set by DATABASE_POOL_MAX, NOT by connection_limit —
    # @prisma/adapter-pg never reads that URL parameter.
    DATABASE_URL=postgresql://sc_app:REPLACE_WITH_SC_APP_PASSWORD@${aws_db_instance.main.endpoint}/spiritual_california?schema=public&sslmode=require
    DATABASE_POOL_MAX=10

    REDIS_HOST=${aws_elasticache_replication_group.main.primary_endpoint_address}
    REDIS_PORT=6379
    REDIS_PASSWORD=${var.redis_transit_encryption ? "SEE /sc/prod/redis/auth-token" : ""}
    REDIS_TLS=${var.redis_transit_encryption ? "true" : "false"}

    # CacheService only. Note rediss:// (two s) when TLS is on.
    REDIS_URL=${var.redis_transit_encryption ? "rediss" : "redis"}://:SEE_AUTH_TOKEN_PARAMETER@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379
    # The cache has never run in any environment. Leave false until its
    # invalidation has been watched under real traffic.
    CACHE_ENABLED=false

    AWS_REGION=${var.region}
    TRUST_PROXY_HOPS=1

    # ── Operator supplies everything below ───────────────────────────────
    JWT_ACCESS_SECRET=PLACEHOLDER_openssl_rand_hex_32
    JWT_REFRESH_SECRET=PLACEHOLDER_different_openssl_rand_hex_32
    JWT_ACCESS_EXPIRES_IN=30m
    JWT_REFRESH_EXPIRES_IN=7d

    AWS_S3_BUCKET=PLACEHOLDER_set_at_P4
    AWS_CLOUDFRONT_URL=PLACEHOLDER_set_at_P4

    STRIPE_SECRET_KEY=PLACEHOLDER_sk_live
    STRIPE_WEBHOOK_SECRET=PLACEHOLDER_whsec
    STRIPE_IDENTITY_WEBHOOK_SECRET=PLACEHOLDER_whsec
    STRIPE_PLATFORM_COMMISSION_PERCENT=20

    RESEND_API_KEY=PLACEHOLDER
    EMAIL_FROM=noreply@spiritualcalifornia.com
    SUPPORT_EMAIL=support@spiritualcalifornia.com

    # Required by the schema even though search runs on Postgres FTS.
    # Non-empty placeholders or the API refuses to boot.
    ALGOLIA_APP_ID=disabled
    ALGOLIA_ADMIN_API_KEY=disabled
    ALGOLIA_SEARCH_API_KEY=disabled
    ALGOLIA_ENABLED=false

    ANTHROPIC_API_KEY=PLACEHOLDER
    ANTHROPIC_MODEL=claude-sonnet-4-6

    ZOOM_ACCOUNT_ID=PLACEHOLDER
    ZOOM_CLIENT_ID=PLACEHOLDER
    ZOOM_CLIENT_SECRET=PLACEHOLDER

    CALENDLY_CLIENT_ID=PLACEHOLDER
    CALENDLY_CLIENT_SECRET=PLACEHOLDER
    CALENDLY_WEBHOOK_SECRET=PLACEHOLDER
    CALENDLY_REDIRECT_URI=https://spiritualcalifornia.com/api/v1/calendly/callback

    STATIC_PAGE_REVALIDATE_SECRET=PLACEHOLDER_must_match_the_frontend

    # ── Behaviour flags — each one deliberate ────────────────────────────
    LEDGER_V2_ENABLED=true
    # Do not auto-sweep real money before the first manual cycle reconciles.
    AUTO_PAYOUT_ENABLED=false
    PAYOUTS_TASKS_ENABLED=true
    ORDER_TASKS_ENABLED=true
    TOUR_TASKS_ENABLED=true
    MIN_PAYOUT_USD=100

    # Defaults to redirect in code so a fresh environment cannot mass-mail
    # real practitioners. Going live is an explicit act.
    INVITE_EMAIL_MODE=redirect
    INVITE_TASKS_ENABLED=false
    INVITE_SEND_PER_DAY=25

    TEST_ACCOUNT_EMAIL_DOMAIN=scprelaunch.test
    EMAIL_HASH_SECRET=PLACEHOLDER_openssl_rand_hex_32
  EOT

  tags = { Name = "sc-prod-api-dotenv-template" }
}
