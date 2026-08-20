import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { SanitizePipe } from './common/sanitize.pipe';
import { PaginationQueryPipe } from './common/pipes/pagination-query.pipe';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Increase body size limit — preserve raw body for Stripe webhooks
  // (signature verification needs the exact bytes, before JSON parsing).
  app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
  app.use('/api/v1/verification/stripe-identity/webhook', express.raw({ type: 'application/json' }));
  // Resend signs practitioner-invite delivery events with Svix, verified over
  // the raw bytes — parsing first would change them and fail every check.
  app.use('/api/v1/invites/webhook/resend', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Trust the reverse proxy in front of us (Nginx on QA, ALB in production).
  //
  // Without this, Express reports the proxy's address as `req.ip` for every
  // caller. Two things break as a result, both silently:
  //   1. ThrottlerModule buckets by `req.ip`, so the ENTIRE site would share
  //      one rate limit — 10 requests/second total, for everyone.
  //   2. Audit logs and abuse investigation record the load balancer instead
  //      of the actual client.
  //
  // The hop count is the number of proxies we control between the client and
  // this process; trusting more hops than that lets a caller forge an
  // arbitrary X-Forwarded-For. One proxy (ALB, or Nginx) is the default.
  const trustProxyHops = configService.get<number>(
    'TRUST_PROXY_HOPS',
    nodeEnv === 'development' ? 0 : 1,
  );
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  // Security — hardened Helmet config
  app.use(helmet({
    contentSecurityPolicy: nodeEnv === 'production' ? undefined : false, // Disable CSP in dev for Swagger
    crossOriginEmbedderPolicy: false, // Allow Calendly/Stripe embeds
    hsts: nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));
  app.use(cookieParser());

  // CORS — allow localhost and any LAN IP in development
  const allowedOrigins =
    nodeEnv === 'production'
      ? [frontendUrl]
      : [frontendUrl, /^http:\/\/localhost:\d+$/, /^http:\/\/172\.\d+\.\d+\.\d+:\d+$/];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'stripe-signature'],
  });

  // Global prefix + versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global pipes: sanitize inputs + validate DTOs + clamp pagination params.
  //
  // PaginationQueryPipe runs last so it sees the final value of `page` /
  // `limit`. It only affects endpoints that read those as raw named query
  // params; DTO-based endpoints (admin) are already validated by
  // ValidationPipe above and keep returning 400 on a bad page.
  // See docs/pagination-hardening.md.
  app.useGlobalPipes(
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
    new PaginationQueryPipe(),
  );

  // Swagger (non-production only)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Spiritual California API')
      .setDescription('Marketplace API for Seekers and Guides')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Rolling deploys and Auto Scaling instance replacement both terminate the
  // process with SIGTERM. Shutdown hooks let Nest run onModuleDestroy across
  // providers first — draining the BullMQ workers and closing the Prisma pool
  // — instead of dropping an in-flight stock-hold release or payout job.
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api/v1`);

  if (nodeEnv !== 'production') {
    console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
