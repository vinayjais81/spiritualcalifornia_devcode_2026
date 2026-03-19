"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().default(3001),
    API_PREFIX: zod_1.z.string().default('api/v1'),
    FRONTEND_URL: zod_1.z.string().url(),
    DATABASE_URL: zod_1.z.string().min(1),
    REDIS_HOST: zod_1.z.string().default('localhost'),
    REDIS_PORT: zod_1.z.coerce.number().default(6379),
    REDIS_PASSWORD: zod_1.z.string().optional(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    AWS_REGION: zod_1.z.string().default('us-west-1'),
    AWS_ACCESS_KEY_ID: zod_1.z.string().min(1),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().min(1),
    AWS_S3_BUCKET: zod_1.z.string().min(1),
    AWS_CLOUDFRONT_URL: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    STRIPE_SECRET_KEY: zod_1.z.string().min(1),
    STRIPE_WEBHOOK_SECRET: zod_1.z.string().min(1),
    STRIPE_PLATFORM_COMMISSION_PERCENT: zod_1.z.coerce.number().default(15),
    RESEND_API_KEY: zod_1.z.string().min(1),
    EMAIL_FROM: zod_1.z.string().min(1).default('noreply@spiritualcalifornia.com'),
    PERSONA_API_KEY: zod_1.z.string().min(1),
    PERSONA_WEBHOOK_SECRET: zod_1.z.string().min(1),
    PERSONA_TEMPLATE_ID: zod_1.z.string().min(1),
    ALGOLIA_APP_ID: zod_1.z.string().min(1),
    ALGOLIA_ADMIN_API_KEY: zod_1.z.string().min(1),
    ALGOLIA_SEARCH_API_KEY: zod_1.z.string().min(1),
    ALGOLIA_GUIDES_INDEX: zod_1.z.string().default('guides'),
    ALGOLIA_EVENTS_INDEX: zod_1.z.string().default('events'),
    ALGOLIA_PRODUCTS_INDEX: zod_1.z.string().default('products'),
    ANTHROPIC_API_KEY: zod_1.z.string().min(1),
    ANTHROPIC_MODEL: zod_1.z.string().default('claude-sonnet-4-6'),
    ZOOM_ACCOUNT_ID: zod_1.z.string().min(1),
    ZOOM_CLIENT_ID: zod_1.z.string().min(1),
    ZOOM_CLIENT_SECRET: zod_1.z.string().min(1),
    GOOGLE_CLIENT_ID: zod_1.z.string().optional().or(zod_1.z.literal('')),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().optional().or(zod_1.z.literal('')),
    GOOGLE_CALLBACK_URL: zod_1.z.string().optional().or(zod_1.z.literal('')),
    CALENDLY_CLIENT_ID: zod_1.z.string().min(1),
    CALENDLY_CLIENT_SECRET: zod_1.z.string().min(1),
    CALENDLY_REDIRECT_URI: zod_1.z.string().url(),
    CALENDLY_WEBHOOK_SECRET: zod_1.z.string().min(1),
});
function validateEnv(config) {
    const result = envSchema.safeParse(config);
    if (!result.success) {
        const errors = result.error.issues
            .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Environment validation failed:\n${errors}`);
    }
    return result.data;
}
//# sourceMappingURL=env.validation.js.map