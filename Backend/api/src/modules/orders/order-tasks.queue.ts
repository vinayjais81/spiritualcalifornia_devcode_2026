import {
  Injectable, OnModuleInit, OnModuleDestroy, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { buildQueueConnection } from '../../common/redis-connection';
import { OrdersService } from './orders.service';

const QUEUE_NAME = 'order-tasks';

// Job names
const JOB_HOLD_REAPER = 'order-hold-reaper';

// Cron schedules
const CRON_HOLD_REAPER = '*/5 * * * *'; // every 5 minutes

interface JobData {
  // intentionally empty — handlers re-query the DB on each run
  [key: string]: unknown;
}

/**
 * Background tasks for shop orders.
 *
 * Today there is exactly one: the hold reaper. `POST /orders` reserves stock
 * (and a promo redemption) the moment the customer clicks "Continue to
 * Payment", which is what stops two people buying the last unit — but nothing
 * released that reservation if they then closed the tab. This worker is the
 * other half of that trade: it walks PENDING orders whose hold has run out and
 * hands the inventory back.
 *
 * Mirrors TourTasksQueue, including the deliberate choice to log and continue
 * when Redis is unavailable rather than refusing to boot the API.
 */
@Injectable()
export class OrderTasksQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderTasksQueue.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string | undefined;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
  ) {
    // Allow disabling via env (useful for tests / CI)
    this.enabled = this.config.get<string>('ORDER_TASKS_ENABLED', 'true') !== 'false';
    this.redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    this.redisPort = Number(this.config.get<string | number>('REDIS_PORT', 6379));
    this.redisPassword = this.config.get<string>('REDIS_PASSWORD');
  }

  async onModuleInit() {
    // Bootstrap must never block on Redis — see buildQueueConnection().
    void this.initQueue();
  }

  private async initQueue() {
    if (!this.enabled) {
      this.logger.warn('[Queue] order-tasks queue disabled via ORDER_TASKS_ENABLED=false');
      return;
    }

    const connection = buildQueueConnection({
      host: this.redisHost,
      port: this.redisPort,
      password: this.redisPassword,
      tls: this.config.get<string>('REDIS_TLS') === 'true',
    });

    try {
      this.queue = new Queue(QUEUE_NAME, { connection });

      this.worker = new Worker<JobData>(
        QUEUE_NAME,
        async (job: Job<JobData>) => {
          this.logger.log(`[Queue] running job: ${job.name}`);
          if (job.name === JOB_HOLD_REAPER) {
            return this.ordersService.releaseExpiredHolds();
          }
          this.logger.warn(`[Queue] unknown job name: ${job.name}`);
        },
        { connection, concurrency: 1 },
      );

      this.worker.on('failed', (job, err) =>
        this.logger.error(`[Queue] ${job?.name} failed: ${err.message}`),
      );

      // Connection-level errors need a listener on BOTH objects. An 'error'
      // event with no listener is an unhandled exception in Node, which is
      // how an unreachable Redis used to fill the log with raw
      // AggregateErrors that no logger had formatted.
      this.queue.on('error', (err) =>
        this.logger.warn(`[Queue] order-tasks connection error: ${err.message}`),
      );
      this.worker.on('error', (err) =>
        this.logger.warn(`[Queue] order-tasks worker error: ${err.message}`),
      );

      // Register cron jobs (idempotent — BullMQ dedupes by repeat key).
      //
      // Deliberately NOT awaited. BullMQ resolves this only once it holds a
      // live connection, so awaiting it hangs onModuleInit — and therefore
      // the entire bootstrap, before app.listen() — for as long as Redis is
      // unreachable. The catch below cannot help: the promise never settles,
      // it simply never resolves.
      //
      // Left pending, it arms the moment Redis becomes reachable, so a cache
      // that is briefly down self-heals instead of needing a restart.
      void this.queue
        .add(
          JOB_HOLD_REAPER,
          {},
          {
            repeat: { pattern: CRON_HOLD_REAPER },
            removeOnComplete: { count: 50 },
            removeOnFail: { count: 50 },
          },
        )
        .then(() =>
          this.logger.log(
            `[Queue] order-tasks worker started — hold-reaper(${CRON_HOLD_REAPER})`,
          ),
        )
        .catch((err: any) =>
          this.logger.error(
            `[Queue] could not arm order-tasks schedule: ${err.message}. Abandoned order holds will not be released until Redis is reachable.`,
          ),
        );
    } catch (err: any) {
      this.logger.error(
        `[Queue] failed to start order-tasks queue: ${err.message}. Abandoned order holds will not be released until Redis is available.`,
      );
      this.queue = null;
      this.worker = null;
    }
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close();
      await this.queue?.close();
    } catch (err: any) {
      this.logger.error(`[Queue] error closing order-tasks queue: ${err.message}`);
    }
  }
}
