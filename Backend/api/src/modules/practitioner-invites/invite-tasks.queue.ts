import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { EmailSendStatus, InviteSendState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InviteSenderService, INVITE_PURPOSE } from './invite-sender.service';

const QUEUE_NAME = 'invite-tasks';
const JOB_DRAIN = 'invite-drain';

/**
 * Every two minutes. The drain job sends at most what the daily cap allows and
 * then stops, so the cadence only controls responsiveness, never volume.
 */
const CRON_DRAIN = '*/2 * * * *';

/** Sent per drain pass, so one tick can't empty a whole day's allowance at once. */
const MAX_PER_PASS = 5;

interface JobData {
  [key: string]: unknown;
}

/**
 * Drains queued practitioner invites.
 *
 * Rate limiting lives in the worker rather than in BullMQ's limiter because the
 * constraint is a *daily* volume across every batch and every restart — the
 * sending domain's reputation doesn't care which wave a message came from, or
 * whether the process was restarted since.
 */
@Injectable()
export class InviteTasksQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InviteTasksQueue.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  private readonly enabled: boolean;
  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sender: InviteSenderService,
  ) {
    this.enabled = this.config.get<string>('INVITE_TASKS_ENABLED', 'true') !== 'false';
    this.redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    this.redisPort = Number(this.config.get<string | number>('REDIS_PORT', 6379));
    this.redisPassword = this.config.get<string>('REDIS_PASSWORD');
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('[Queue] invite-tasks disabled via INVITE_TASKS_ENABLED=false');
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
          if (job.name === JOB_DRAIN) return this.drain();
          this.logger.warn(`[Queue] unknown job name: ${job.name}`);
        },
        { connection, concurrency: 1 },
      );

      this.worker.on('failed', (job, err) =>
        this.logger.error(`[Queue] ${job?.name} failed: ${err.message}`),
      );

      await this.queue.add(
        JOB_DRAIN,
        {},
        {
          repeat: { pattern: CRON_DRAIN },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      );

      this.logger.log(
        `[Queue] invite-tasks worker started — drain(${CRON_DRAIN}), mode=${this.sender.isLive ? 'LIVE' : 'redirect'}`,
      );
    } catch (err: any) {
      this.logger.error(
        `[Queue] failed to start invite-tasks: ${err.message}. Queued invites will not be sent until Redis is available.`,
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
      this.logger.error(`[Queue] error closing invite-tasks: ${err.message}`);
    }
  }

  /**
   * One pass: send a few invites if the cap, the window and the wave state all
   * allow it. Every guard is re-checked here rather than trusted from queue
   * time — days can pass between the two.
   */
  private async drain() {
    if (!this.sender.isWithinSendWindow()) {
      return { sent: 0, reason: 'outside the send window' };
    }

    const allowance = Math.min(MAX_PER_PASS, await this.sender.remainingToday());
    if (allowance <= 0) return { sent: 0, reason: 'daily cap reached' };

    const pending = await this.prisma.emailSend.findMany({
      where: {
        purpose: INVITE_PURPOSE,
        status: EmailSendStatus.QUEUED,
        // A paused wave stops mid-flight; its remaining jobs simply aren't
        // picked up until someone resumes it.
        batch: { inviteState: InviteSendState.SENDING },
      },
      orderBy: { queuedAt: 'asc' },
      take: allowance,
      select: { id: true, importBatchId: true },
    });

    if (pending.length === 0) {
      await this.completeDrainedBatches();
      return { sent: 0 };
    }

    let sent = 0;
    const touchedBatches = new Set<string>();

    for (const row of pending) {
      const outcome = await this.sender.sendOne(row.id);
      if (outcome.status === EmailSendStatus.SENT) sent++;
      if (row.importBatchId) touchedBatches.add(row.importBatchId);
    }

    // Bounces surface via webhook rather than at send time, but evaluating here
    // too means a batch that is already over the line stops on the next pass
    // even if a webhook is delayed or never arrives.
    for (const batchId of touchedBatches) {
      await this.sender.evaluateCircuitBreaker(batchId);
    }

    await this.completeDrainedBatches();
    if (sent > 0) this.logger.log(`[Queue] sent ${sent} invite(s)`);
    return { sent };
  }

  /** Flip a wave to COMPLETED once nothing is left queued for it. */
  private async completeDrainedBatches() {
    const sending = await this.prisma.importBatch.findMany({
      where: { inviteState: InviteSendState.SENDING },
      select: { id: true },
    });

    for (const batch of sending) {
      const remaining = await this.prisma.emailSend.count({
        where: {
          importBatchId: batch.id,
          purpose: INVITE_PURPOSE,
          status: EmailSendStatus.QUEUED,
        },
      });
      if (remaining === 0) {
        await this.prisma.importBatch.update({
          where: { id: batch.id },
          data: { inviteState: InviteSendState.COMPLETED },
        });
      }
    }
  }
}
