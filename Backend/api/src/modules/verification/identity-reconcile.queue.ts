import {
  Injectable, OnModuleInit, OnModuleDestroy, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from '../payments/stripe.service';
import { VerificationService } from './verification.service';

const QUEUE_NAME = 'identity-reconcile';
const JOB_RECONCILE = 'identity-reconcile';

// Every 15 minutes: self-heal IdentityVerification rows whose webhook was
// missed (e.g. endpoint down, or subscription set up after the event fired).
// Webhooks are an optimization; this job is the guarantee of eventual
// consistency with Stripe.
const CRON_RECONCILE = '*/15 * * * *';

// Non-terminal statuses worth re-checking against Stripe.
const NON_TERMINAL = ['requires_input', 'processing'];

// Give the webhook a head start before reconciling a fresh row.
const STALE_MS = 2 * 60 * 1000;

// Cap Stripe calls per run.
const BATCH = 200;

interface JobData { [key: string]: unknown; }

@Injectable()
export class IdentityReconcileQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdentityReconcileQueue.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string | undefined;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly verification: VerificationService,
  ) {
    this.enabled = this.config.get<string>('IDENTITY_RECONCILE_ENABLED', 'true') !== 'false';
    this.redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    this.redisPort = Number(this.config.get<string | number>('REDIS_PORT', 6379));
    this.redisPassword = this.config.get<string>('REDIS_PASSWORD');
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('[Queue] identity-reconcile disabled via IDENTITY_RECONCILE_ENABLED=false');
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
          if (job.name === JOB_RECONCILE) {
            return this.runReconcile();
          }
          this.logger.warn(`[Queue] unknown job name: ${job.name}`);
        },
        { connection, concurrency: 1 },
      );

      this.worker.on('failed', (job, err) =>
        this.logger.error(`[Queue] ${job?.name} failed: ${err.message}`),
      );

      await this.queue.add(
        JOB_RECONCILE,
        {},
        {
          repeat: { pattern: CRON_RECONCILE },
          removeOnComplete: { count: 30 },
          removeOnFail: { count: 30 },
        },
      );

      this.logger.log(`[Queue] identity-reconcile worker started — reconcile(${CRON_RECONCILE})`);
    } catch (err: any) {
      this.logger.error(
        `[Queue] failed to start identity-reconcile queue: ${err.message}. ` +
        `Identity rows will not auto-heal until Redis is available.`,
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
      this.logger.error(`[Queue] error closing identity-reconcile queue: ${err.message}`);
    }
  }

  /**
   * For each non-terminal IdentityVerification row older than STALE_MS, fetch
   * the live VerificationSession from Stripe and, if its status has advanced,
   * push it through the SAME path as the webhook (handleIdentityWebhook) so the
   * DB + guide IN_REVIEW transition behave identically. Idempotent.
   */
  private async runReconcile() {
    // Skip entirely in stub mode — there are no real Stripe sessions to query.
    if (!this.verification.isIdentityLive()) {
      return { skipped: 'stub-mode' };
    }

    const rows = await this.prisma.identityVerification.findMany({
      where: {
        status: { in: NON_TERMINAL },
        updatedAt: { lt: new Date(Date.now() - STALE_MS) },
      },
      select: { verificationSessionId: true, status: true },
      take: BATCH,
      orderBy: { updatedAt: 'asc' },
    });

    let checked = 0;
    let updated = 0;

    for (const row of rows) {
      // Defensive: never call Stripe for a stub session id.
      if (row.verificationSessionId.startsWith('vs_stub_')) continue;
      checked++;
      try {
        const session = await this.stripe.retrieveIdentitySession(row.verificationSessionId);
        if (session.status !== row.status) {
          await this.verification.handleIdentityWebhook({
            verificationSessionId: session.id,
            status: session.status,
            lastError: session.last_error?.reason ?? null,
          });
          updated++;
          this.logger.log(
            `[identity-reconcile] ${session.id}: ${row.status} → ${session.status}`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `[identity-reconcile] could not reconcile ${row.verificationSessionId}: ${err.message}`,
        );
      }
    }

    this.logger.log(`[identity-reconcile] checked ${checked} non-terminal rows, updated ${updated}`);
    return { checked, updated };
  }
}
