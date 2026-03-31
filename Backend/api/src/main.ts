import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { SanitizePipe } from './common/sanitize.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Increase body size limit — preserve raw body for Stripe webhook
  app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

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

  // Global pipes: sanitize inputs + validate DTOs
  app.useGlobalPipes(
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
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

  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api/v1`);

  if (nodeEnv !== 'production') {
    console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
