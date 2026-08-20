import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_PREFIX: z.string().default('api/v1'),
  FRONTEND_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1),

  // App — reverse proxy. Number of proxies we control between the client and
  // this process (Nginx on QA, ALB in production). Defaults to 1 outside
  // development; see main.ts for why getting this wrong breaks rate limiting.
  TRUST_PROXY_HOPS: z.coerce.number().min(0).max(5).optional(),

  // Database — pg Pool size. PrismaService drives a `pg` Pool directly via
  // @prisma/adapter-pg, so Prisma's `connection_limit` URL parameter does
  // NOT apply; the pool is sized here (pg's own default is 10). Budget:
  // instances x processes x this value must stay well under the RDS
  // max_connections.
  DATABASE_POOL_MAX: z.coerce.number().min(1).max(100).optional(),

  // Redis — queues (BullMQ) connect with the discrete host/port/password
  // below. REDIS_TLS must be 'true' for an ElastiCache group with in-transit
  // encryption enabled, or every worker fails to connect.
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.string().optional(),

  // Cache kill switch. Defaults to OFF, which preserves the behaviour every
  // environment has actually had to date (see REDIS_URL below). Turning the
  // cache on is therefore a deliberate act, and — more importantly — turning
  // it back off is an env change rather than a code deploy.
  CACHE_ENABLED: z.string().optional(),

  // Redis — CacheService connects with this URL instead of the fields above.
  //
  // It was previously absent from this schema, which meant Zod stripped it and
  // ConfigService always returned undefined: CacheService silently disabled
  // itself in every environment, and every getOrSet() fell through to Postgres.
  // Declaring it here is what makes the cache layer real.
  REDIS_URL: z.string().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  // 30m default: long enough to absorb short idle periods without forcing a
  // refresh round-trip; short enough that a leaked access token isn't useful
  // for long. The frontend schedules a silent refresh 2 minutes before expiry.
  JWT_ACCESS_EXPIRES_IN: z.string().default('30m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // AWS
  AWS_REGION: z.string().default('us-west-1'),

  // OPTIONAL, and absent in production on purpose.
  //
  // Production runs on EC2 with an instance role (sc-prod-ec2-role), so the
  // SDK's default credential chain supplies rotating credentials and no
  // static key exists to leak. Requiring these would force placeholder
  // values into the environment — and a placeholder is worse than nothing,
  // because the SDK would try to use it instead of falling through to the
  // instance profile. See src/common/aws-config.ts.
  //
  // Still set locally and on QA, which have no instance profile to inherit.
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Textract is not available in every region. Defaults to AWS_REGION;
  // verified 2026-08-20 that us-west-1 does offer it, so production needs no
  // override.
  AWS_TEXTRACT_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_CLOUDFRONT_URL: z.string().url().optional().or(z.literal('')),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PLATFORM_COMMISSION_PERCENT: z.coerce.number().default(15),

  // Guide subscription ($50/mo Standard listing). Price IDs are optional: when
  // unset the payments service lazily creates recurring Prices in Stripe keyed
  // by lookup_key so the flow works out-of-the-box in the sandbox; set these in
  // production to pin to Prices you manage in the Stripe dashboard.
  STRIPE_SUBSCRIPTION_PRICE_MONTHLY: z.string().optional(),
  STRIPE_SUBSCRIPTION_PRICE_ANNUAL: z.string().optional(),
  // Length of the free listing period, in days, honored as a Stripe trial when
  // a guide subscribes (kept as a string; consuming code does its own Number()).
  GUIDE_FREE_PERIOD_DAYS: z.string().optional(),

  // Resend (Email)
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1).default('noreply@spiritualcalifornia.com'),

  // Stripe Identity (identity verification). Uses STRIPE_SECRET_KEY for the
  // API; the webhook secret is optional — the verification service stays in
  // stub mode until it's set (and the real Stripe Identity endpoint is live).
  STRIPE_IDENTITY_WEBHOOK_SECRET: z.string().optional(),

  // Algolia (Search)
  ALGOLIA_APP_ID: z.string().min(1),
  ALGOLIA_ADMIN_API_KEY: z.string().min(1),
  ALGOLIA_SEARCH_API_KEY: z.string().min(1),
  ALGOLIA_GUIDES_INDEX: z.string().default('guides'),
  ALGOLIA_EVENTS_INDEX: z.string().default('events'),
  ALGOLIA_PRODUCTS_INDEX: z.string().default('products'),

  // Anthropic (Claude AI)
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),

  // Zoom
  ZOOM_ACCOUNT_ID: z.string().min(1),
  ZOOM_CLIENT_ID: z.string().min(1),
  ZOOM_CLIENT_SECRET: z.string().min(1),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional().or(z.literal('')),
  GOOGLE_CLIENT_SECRET: z.string().optional().or(z.literal('')),
  GOOGLE_CALLBACK_URL: z.string().optional().or(z.literal('')),

  // Calendly OAuth
  CALENDLY_CLIENT_ID: z.string().min(1),
  CALENDLY_CLIENT_SECRET: z.string().min(1),
  CALENDLY_REDIRECT_URI: z.string().url(),
  CALENDLY_WEBHOOK_SECRET: z.string().min(1),

  // CMS — shared secret for calling the Next.js `revalidate-static-page`
  // webhook after admin CRUD. Optional: if missing, admin saves still
  // succeed but public pages stay cached for up to 5 minutes.
  STATIC_PAGE_REVALIDATE_SECRET: z.string().optional().or(z.literal('')),

  // Background-queue kill switches. Set to 'false' to disable the cron.
  TOUR_TASKS_ENABLED: z.string().optional(),

  // Algolia kill switch. When 'false' (the default since 2026-05-20), all
  // Algolia SDK calls no-op and search is served by Postgres FTS via
  // PostgresSearchService. Flip to 'true' + populate ALGOLIA_APP_ID /
  // ALGOLIA_ADMIN_API_KEY to revert to Algolia.
  ALGOLIA_ENABLED: z.string().optional(),

  // Pre-launch test-account domain. Emails ending in @<this> at register
  // time are auto-flagged isTestAccount = true so the admin "Convert
  // test account" workflow can later swap them to real emails. Defaults
  // to scprelaunch.test (RFC-reserved .test TLD, can't accidentally
  // route real mail).
  TEST_ACCOUNT_EMAIL_DOMAIN: z.string().optional(),

  // ── Guide payouts (v2 / v2.1) flags + tunables ──────────────────────────
  // These MUST be declared here. Zod's z.object() strips unknown keys, and
  // @nestjs/config only exposes validated keys — so any env var missing from
  // this schema resolves to undefined no matter what .env contains. That is
  // why LEDGER_V2_ENABLED / AUTO_PAYOUT_ENABLED appeared to be ignored: the
  // flag was stripped before the app could read it. Kept as strings because
  // the consuming code does its own Number()/'true' parsing.
  LEDGER_V2_ENABLED: z.string().optional(),
  AUTO_PAYOUT_ENABLED: z.string().optional(),
  AUTO_PAYOUT_CRON: z.string().optional(),
  PAYOUTS_TASKS_ENABLED: z.string().optional(),
  MIN_PAYOUT_USD: z.string().optional(),
  STRIPE_PROCESSING_FEE_PERCENT: z.string().optional(),
  STRIPE_PROCESSING_FEE_FLAT: z.string().optional(),
  EVENT_BOOKING_FEE_PERCENT: z.string().optional(),

  // ── Shop order stock holds ──────────────────────────────────────────────
  // Same rule as the flags above: declared here or the app never sees them.
  // See docs/order-hold-expiry.md.
  ORDER_HOLD_MINUTES: z.string().optional(),
  ORDER_TASKS_ENABLED: z.string().optional(),

  // ── Practitioner import ────────────────────────────────────────────────
  // HMAC key for email suppression tombstones. Same declaration rule applies:
  // undeclared here means the service silently falls back to JWT_ACCESS_SECRET
  // however the .env reads. See docs/practitioner-import-phase-1.md.
  EMAIL_HASH_SECRET: z.string().optional(),

  // ── Practitioner invites (sending) ─────────────────────────────────────
  // INVITE_EMAIL_MODE defaults to 'redirect' in code, so an environment that
  // never set it cannot mail real practitioners. Going live is an explicit act.
  INVITE_EMAIL_MODE: z.string().optional(),
  INVITE_EMAIL_REDIRECT_TO: z.string().optional(),
  INVITE_SEND_PER_DAY: z.string().optional(),
  INVITE_TASKS_ENABLED: z.string().optional(),
  INVITE_EMAIL_FROM: z.string().optional(),
  INVITE_SENDER_NAME: z.string().optional(),
  INVITE_REPLY_TO: z.string().optional(),
  INVITE_POSTAL_ADDRESS: z.string().optional(),
  INVITE_SOURCE_DESCRIPTION: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  RETURN_WINDOW_DAYS: z.string().optional(),
  SUPPORT_EMAIL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}
