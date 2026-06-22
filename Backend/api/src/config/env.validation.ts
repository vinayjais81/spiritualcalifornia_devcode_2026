import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_PREFIX: z.string().default('api/v1'),
  FRONTEND_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

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
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_CLOUDFRONT_URL: z.string().url().optional().or(z.literal('')),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PLATFORM_COMMISSION_PERCENT: z.coerce.number().default(15),

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
