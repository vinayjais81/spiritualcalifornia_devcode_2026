import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';

export type ComponentStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  uptimeSeconds: number;
  components: Record<string, { status: ComponentStatus; latencyMs?: number; error?: string }>;
}

/** A probe that hangs is a probe that lies — bound every dependency check. */
const PROBE_TIMEOUT_MS = 2000;

function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} probe timed out after ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS),
    ),
  ]);
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Deep readiness check — the dependencies the app cannot serve without.
   *
   * Deliberately NOT what the load balancer polls. If the database blips, a
   * deep check would mark every instance unhealthy at the same moment; the
   * ALB has nowhere better to route, so all it achieves is turning a slow
   * database into a hard outage. The load balancer polls `/health/live`;
   * this endpoint gates deploys and feeds monitoring.
   */
  async check(): Promise<HealthReport> {
    const components: HealthReport['components'] = {};

    const [db, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    components.database = db;
    components.redis = redis;

    const status = Object.values(components).every((c) => c.status === 'up') ? 'ok' : 'error';
    return { status, uptimeSeconds: Math.round(process.uptime()), components };
  }

  private async checkDatabase() {
    const started = Date.now();
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, 'database');
      return { status: 'up' as const, latencyMs: Date.now() - started };
    } catch (err: any) {
      this.logger.error(`Database health probe failed: ${err.message}`);
      return { status: 'down' as const, latencyMs: Date.now() - started, error: err.message };
    }
  }

  /**
   * Probes the queue Redis (REDIS_HOST/REDIS_PORT) rather than the cache
   * Redis — this is the instance BullMQ uses, so it is the one holding stock
   * holds, payout runs and invite scheduling.
   */
  private async checkRedis() {
    const started = Date.now();
    try {
      const client = this.getRedis();
      const pong = await withTimeout(client.ping(), 'redis');
      if (pong !== 'PONG') throw new Error(`unexpected PING reply: ${pong}`);
      return { status: 'up' as const, latencyMs: Date.now() - started };
    } catch (err: any) {
      this.logger.error(`Redis health probe failed: ${err.message}`);
      return { status: 'down' as const, latencyMs: Date.now() - started, error: err.message };
    }
  }

  private getRedis(): Redis {
    if (this.redis) return this.redis;

    const password = this.config.get<string>('REDIS_PASSWORD');
    const useTls = this.config.get<string>('REDIS_TLS') === 'true';

    this.redis = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.config.get<string | number>('REDIS_PORT', 6379)),
      ...(password ? { password } : {}),
      ...(useTls ? { tls: {} } : {}),
      // A health probe must fail fast rather than queue commands behind a
      // reconnect loop, which is exactly what the ioredis defaults would do.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: PROBE_TIMEOUT_MS,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });

    this.redis.on('error', (err) => this.logger.warn(`Health Redis client error: ${err.message}`));
    return this.redis;
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }
}
