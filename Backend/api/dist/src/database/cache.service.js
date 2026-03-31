"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let CacheService = class CacheService {
    static { CacheService_1 = this; }
    config;
    redis = null;
    logger = new common_1.Logger(CacheService_1.name);
    enabled;
    constructor(config) {
        this.config = config;
        const redisUrl = this.config.get('REDIS_URL');
        this.enabled = !!redisUrl;
    }
    async onModuleInit() {
        if (!this.enabled) {
            this.logger.warn('Redis not configured — caching disabled');
            return;
        }
        try {
            this.redis = new ioredis_1.default(this.config.get('REDIS_URL'), {
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => Math.min(times * 200, 2000),
            });
            this.redis.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
            await this.redis.ping();
            this.logger.log('Redis connected for caching');
        }
        catch (err) {
            this.logger.warn(`Redis connection failed: ${err.message} — caching disabled`);
            this.redis = null;
        }
    }
    async onModuleDestroy() {
        await this.redis?.quit();
    }
    async get(key) {
        if (!this.redis)
            return null;
        try {
            const data = await this.redis.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch {
            return null;
        }
    }
    async set(key, value, ttlSeconds = 300) {
        if (!this.redis)
            return;
        try {
            await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
        }
        catch { }
    }
    async del(key) {
        if (!this.redis)
            return;
        try {
            await this.redis.del(key);
        }
        catch { }
    }
    async delPattern(pattern) {
        if (!this.redis)
            return;
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0)
                await this.redis.del(...keys);
        }
        catch { }
    }
    async getOrSet(key, fetcher, ttlSeconds = 300) {
        const cached = await this.get(key);
        if (cached !== null)
            return cached;
        const fresh = await fetcher();
        await this.set(key, fresh, ttlSeconds);
        return fresh;
    }
    static keys = {
        guideProfile: (slug) => `guide:profile:${slug}`,
        guideCategories: () => 'guide:categories',
        product: (id) => `product:${id}`,
        productsList: (page) => `products:list:${page}`,
        homeData: () => 'home:data',
        shippingMethods: () => 'checkout:shipping',
        taxRates: () => 'checkout:tax',
        eventsList: (page) => `events:list:${page}`,
        toursList: (page) => `tours:list:${page}`,
    };
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CacheService);
//# sourceMappingURL=cache.service.js.map