import type { RedisOptions } from 'ioredis';

export interface QueueRedisParams {
  host: string;
  port: number;
  password?: string;
  /** ElastiCache replication groups with in-transit encryption require TLS. */
  tls?: boolean;
}

/**
 * Connection options shared by every BullMQ queue.
 *
 * Two settings, both deliberate:
 *
 * `maxRetriesPerRequest: null` is BullMQ's documented requirement for the
 * blocking commands its Workers issue.
 *
 * The offline queue is left ON (ioredis's default). Commands issued while
 * disconnected stay buffered and complete once the connection returns, which
 * is what lets a queue arm its repeatable job by itself after a Redis blip
 * rather than needing a process restart.
 *
 * That buffering is also a trap, and the reason the callers must never await
 * the arming call: a buffered command NEVER SETTLES while Redis is down —
 * it is neither resolved nor rejected. Awaiting it inside onModuleInit hangs
 * Nest's bootstrap before app.listen(), so the API never serves and no
 * try/catch around it can report why. Callers fire the arming call and
 * attach .then/.catch instead.
 *
 * On the QA box none of this is visible: Redis is on localhost and is up
 * whenever the instance is up. Production is where it bites — ElastiCache is
 * a cross-AZ dependency with failovers and maintenance windows, so an
 * instance starting during a blip would hang forever and never pass a health
 * check, and in an Auto Scaling group replacements would never go into
 * service.
 */
export function buildQueueConnection(params: QueueRedisParams): RedisOptions {
  return {
    host: params.host,
    port: params.port,
    ...(params.password ? { password: params.password } : {}),
    ...(params.tls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
  };
}
