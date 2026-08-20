import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Attempts before the cache gives up and the app serves uncached. */
const MAX_CONNECT_ATTEMPTS = 5;

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private readonly logger = new Logger(CacheService.name);
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    this.enabled = !!redisUrl;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Redis not configured — caching disabled');
      return;
    }
    // The cache is an optimisation, never a dependency: if Redis is
    // unreachable the app must still boot and serve from Postgres.
    //
    // Getting there needs all four options below. The previous retryStrategy
    // returned a delay forever and never null, so an unreachable Redis
    // reconnected in an endless loop and surfaced an unhandled
    // AggregateError that took the whole process down at startup — which is
    // exactly what a cache must never do.
    const client = new Redis(this.config.get<string>('REDIS_URL')!, {
      // Give up rather than reconnect forever.
      retryStrategy: (times) => (times > MAX_CONNECT_ATTEMPTS ? null : Math.min(times * 200, 2000)),
      maxRetriesPerRequest: 2,
      // Fail commands immediately while disconnected instead of queueing them
      // up to be rejected later, off the back of no active promise chain.
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 5000,
    });

    // Attach before connecting: an 'error' with no listener is an unhandled
    // exception in Node, and that is the crash path we are closing.
    client.on('error', (err) => {
      if (this.redis) {
        this.logger.warn(`Redis cache error: ${err.message}`);
      }
    });
    client.on('end', () => {
      if (this.redis) {
        this.redis = null;
        this.logger.warn('Redis cache connection closed — serving uncached until restart');
      }
    });

    try {
      await client.connect();
      await client.ping();
      this.redis = client;
      this.logger.log('Redis connected for caching');
    } catch (err: any) {
      this.logger.warn(`Redis connection failed: ${err.message} — caching disabled`);
      this.redis = null;
      client.disconnect();
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  // ─── Core Operations ───────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch { /* skip */ }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try { await this.redis.del(key); } catch { /* skip */ }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch { /* skip */ }
  }

  // ─── Cache-Aside Pattern ───────────────────────────────────────────────────

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  // ─── Predefined Cache Keys ─────────────────────────────────────────────────

  static keys = {
    guideProfile: (slug: string) => `guide:profile:${slug}`,
    guideCategories: () => 'guide:categories',
    product: (id: string) => `product:${id}`,
    productsList: (page: number) => `products:list:${page}`,
    homeData: () => 'home:data',
    shippingMethods: () => 'checkout:shipping',
    taxRates: () => 'checkout:tax',
    eventsList: (page: number) => `events:list:${page}`,
    toursList: (page: number) => `tours:list:${page}`,
  };
}
