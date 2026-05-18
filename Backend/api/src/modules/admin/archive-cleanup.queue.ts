import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { AdminService } from './admin.service';

const QUEUE_NAME = 'archive-cleanup';
const JOB_HARD_DELETE = 'archived-guide-hard-delete';
// Daily at 03:00 — quiet hours, well clear of the booking-traffic peak.
const CRON_PATTERN = '0 3 * * *';

interface JobData {
  graceDays?: number;
}

/**
 * Daily worker that hard-deletes archived guide registrations past the 90-day
 * grace window. The actual purge logic lives on AdminService — this class is
 * just the BullMQ wiring (mirroring tour-tasks.queue.ts).
 *
 * Auto-disables when no Redis connection is available so a dev box without
 * Redis still boots; the manual /admin/guides/cleanup-archived endpoint
 * remains available either way.
 */
@Injectable()
export class ArchiveCleanupQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArchiveCleanupQueue.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string | undefined;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AdminService))
    private readonly admin: AdminService,
  ) {
    this.enabled =
      this.config.get<string>('ARCHIVE_CLEANUP_ENABLED', 'true') !== 'false';
    this.redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    this.redisPort = Number(this.config.get<string | number>('REDIS_PORT', 6379));
    this.redisPassword = this.config.get<string>('REDIS_PASSWORD');
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn(
        '[Queue] archive-cleanup disabled via ARCHIVE_CLEANUP_ENABLED=false',
      );
      return;
    }

    const connection = {
      host: this.redisHost,
      port: this.redisPort,
      ...(this.redisPassword ? { password: this.redisPassword } : {}),
    };

    try {
      this.queue = new Queue(QUEUE_NAME, { connection });
      this.worker = new Worker<JobData>(
        QUEUE_NAME,
        async (job: Job<JobData>) => {
          if (job.name !== JOB_HARD_DELETE) {
            this.logger.warn(`[Queue] unknown job name: ${job.name}`);
            return;
          }
          const result = await this.admin.hardDeleteExpiredArchivedGuides(
            job.data.graceDays ?? 90,
          );
          this.logger.log(
            `[Queue] archived-guide-hard-delete: processed=${result.processed} ok=${result.succeeded} fail=${result.failed}`,
          );
          return result;
        },
        { connection, concurrency: 1 },
      );

      this.worker.on('failed', (job, err) =>
        this.logger.error(`[Queue] ${job?.name} failed: ${err.message}`),
      );

      await this.queue.add(
        JOB_HARD_DELETE,
        {},
        {
          repeat: { pattern: CRON_PATTERN },
          removeOnComplete: { count: 30 },
          removeOnFail: { count: 30 },
        },
      );

      this.logger.log(
        `[Queue] archive-cleanup worker started — schedule: ${CRON_PATTERN}`,
      );
    } catch (err: any) {
      this.logger.error(
        `[Queue] failed to start archive-cleanup: ${err.message}. The /admin/guides/cleanup-archived endpoint still works for manual runs.`,
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
      this.logger.error(`[Queue] error closing archive-cleanup: ${err.message}`);
    }
  }
}
