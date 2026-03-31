"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express = __importStar(require("express"));
const app_module_1 = require("./app.module");
const sanitize_pipe_1 = require("./common/sanitize.pipe");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('PORT', 3001);
    const frontendUrl = configService.get('FRONTEND_URL', 'http://localhost:3000');
    const nodeEnv = configService.get('NODE_ENV', 'development');
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
        crossOriginEmbedderPolicy: false,
        hsts: nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    }));
    app.use((0, cookie_parser_1.default)());
    const allowedOrigins = nodeEnv === 'production'
        ? [frontendUrl]
        : [frontendUrl, /^http:\/\/localhost:\d+$/, /^http:\/\/172\.\d+\.\d+\.\d+:\d+$/];
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'stripe-signature'],
    });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: common_1.VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new sanitize_pipe_1.SanitizePipe(), new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    if (nodeEnv !== 'production') {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('Spiritual California API')
            .setDescription('Marketplace API for Seekers and Guides')
            .setVersion('1.0')
            .addBearerAuth()
            .addCookieAuth('refresh_token')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document, {
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
//# sourceMappingURL=main.js.map