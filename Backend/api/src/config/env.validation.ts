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

  // Persona (Identity Verification)
  PERSONA_API_KEY: z.string().min(1),
  PERSONA_WEBHOOK_SECRET: z.string().min(1),
  PERSONA_TEMPLATE_ID: z.string().min(1),

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
