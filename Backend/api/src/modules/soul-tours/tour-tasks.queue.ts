import {
  Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SoulToursService } from './soul-tours.service';

const QUEUE_NAME = 'tour-tasks';

// Job names
const JOB_HOLD_REAPER = 'tour-hold-reaper';
const JOB_BALANCE_REMINDER = 'tour-balance-reminder';
const JOB_DEPARTURE_REMINDER = 'tour-departure-reminder';

// Cron schedules
const CRON_HOLD_REAPER = '*/5 * * * *';        // every 5 minutes
const CRON_BALANCE_REMINDER = '0 9 * * *';      // daily at 09:00
const CRON_DEPARTURE_REMINDER = '0 9 * * *';    // daily at 09:00

// Reminder windows (days before due date / departure)
const BALANCE_REMINDER_DAYS = [14, 7, 1];
const DEPARTURE_REMINDER_DAYS = [7, 1];

interface JobData {
  // intentionally empty — handlers re-query the DB on each run
  [key: string]: unknown;
}

@Injectable()
export class TourTasksQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TourTasksQueue.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string | undefined;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => SoulToursService))
    private readonly soulTours: SoulToursService,
  ) {
    // Allow disabling via env (useful for tests / CI)
    this.enabled = this.config.get<string>('TOUR_TASKS_ENABLED', 'true') !== 'false';
    this.redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    this.redisPort = Number(this.config.get<string | number>('REDIS_PORT', 6379));
    this.redisPassword = this.config.get<string>('REDIS_PASSWORD');
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('[Queue] tour-tasks queue disabled via TOUR_TASKS_ENABLED=false');
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
          this.logger.log(`[Queue] running job: ${job.name}`);
          if (job.name === JOB_HOLD_REAPER) {
            return this.runHoldReaper();
          }
          if (job.name === JOB_BALANCE_REMINDER) {
            return this.runBalanceReminders();
          }
          if (job.name === JOB_DEPARTURE_REMINDER) {
            return this.runDepartureReminders();
          }
          this.logger.warn(`[Queue] unknown job name: ${job.name}`);
        },
        { connection, concurrency: 2 },
      );

      this.worker.on('completed', (job) =>
        this.logger.log(`[Queue] ${job.name} completed`),
      );
      this.worker.on('failed', (job, err) =>
        this.logger.error(`[Queue] ${job?.name} failed: ${err.message}`),
      );

      // Register cron jobs (idempotent — BullMQ dedupes by repeat key)
      await this.queue.add(
        JOB_HOLD_REAPER,
        {},
        {
          repeat: { pattern: CRON_HOLD_REAPER },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      );
      await this.queue.add(
        JOB_BALANCE_REMINDER,
        {},
        {
          repeat: { pattern: CRON_BALANCE_REMINDER },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      );
      await this.queue.add(
        JOB_DEPARTURE_REMINDER,
        {},
        {
          repeat: { pattern: CRON_DEPARTURE_REMINDER },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      );

      this.logger.log(
        `[Queue] tour-tasks worker started — hold-reaper(${CRON_HOLD_REAPER}), balance-reminder(${CRON_BALANCE_REMINDER}), departure-reminder(${CRON_DEPARTURE_REMINDER})`,
      );
    } catch (err: any) {
      this.logger.error(`[Queue] failed to start tour-tasks queue: ${err.message}. Tour notifications and hold reaping will not run until Redis is available.`);
      this.queue = null;
      this.worker = null;
    }
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close();
      await this.queue?.close();
    } catch (err: any) {
      this.logger.error(`[Queue] error closing tour-tasks queue: ${err.message}`);
    }
  }

  // ─── Job: hold reaper ────────────────────────────────────────────────────

  private async runHoldReaper() {
    const result = await this.soulTours.releaseExpiredHolds();
    return { released: result.released };
  }

  // ─── Job: balance reminders ──────────────────────────────────────────────

  private async runBalanceReminders() {
    const now = new Date();
    let sent = 0;

    for (const days of BALANCE_REMINDER_DAYS) {
      // Window: bookings whose balanceDueAt falls into the day exactly N days from now.
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + days);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 1);

      const candidates = await this.prisma.tourBooking.findMany({
        where: {
          status: 'DEPOSIT_PAID',
          balanceDueAt: { gte: windowStart, lt: windowEnd },
          // Only send each reminder window once
          balanceReminderSentAt: null,
        },
        include: {
          tour: { select: { title: true } },
          departure: { select: { startDate: true, endDate: true } },
          seeker: { select: { userId: true, user: { select: { email: true, firstName: true } } } },
        },
      });

      for (const b of candidates) {
        if (!b.balanceDueAt || !b.seeker?.user) continue;
        try {
          const fmt = (d: Date) =>
            d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const departureDates = b.departure
            ? `${fmt(b.departure.startDate)} – ${fmt(b.departure.endDate)}`
            : 'TBD';

          await this.notifications.notifyTourBalanceReminder({
            seekerUserId: b.seeker.userId,
            seekerEmail: b.contactEmail || b.seeker.user.email,
            seekerName: b.contactFirstName || b.seeker.user.firstName || 'there',
            tourTitle: b.tour.title,
            bookingReference: b.bookingReference || b.id.slice(-8).toUpperCase(),
            bookingId: b.id,
            departureDates,
            balanceDue: `$${Number(b.balanceAmount ?? 0).toLocaleString()}`,
            balanceDueDate: fmt(b.balanceDueAt),
            daysUntilDue: days,
          });

          // Stamp so we don't re-send for this booking on subsequent windows
          await this.prisma.tourBooking.update({
            where: { id: b.id },
            data: { balanceReminderSentAt: new Date() },
          });

          sent++;
        } catch (err: any) {
          this.logger.error(`Failed to send balance reminder for booking ${b.id}: ${err.message}`);
        }
      }
    }

    if (sent > 0) {
      this.logger.log(`[Queue] sent ${sent} balance reminder(s)`);
    }
    return { sent };
  }

  // ─── Job: departure reminders ────────────────────────────────────────────

  private async runDepartureReminders() {
    const now = new Date();
    let sent = 0;

    for (const days of DEPARTURE_REMINDER_DAYS) {
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + days);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 1);

      const candidates = await this.prisma.tourBooking.findMany({
        where: {
          status: { in: ['DEPOSIT_PAID', 'FULLY_PAID', 'CONFIRMED'] },
          departure: { startDate: { gte: windowStart, lt: windowEnd } },
        },
        include: {
          tour: { select: { title: true, meetingPoint: true, location: true } },
          departure: { select: { startDate: true, endDate: true } },
          seeker: { select: { userId: true, user: { select: { email: true, firstName: true } } } },
        },
      });

      for (const b of candidates) {
        if (!b.departure || !b.seeker?.user) continue;
        try {
          const fmt = (d: Date) =>
            d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const departureDates = `${fmt(b.departure.startDate)} – ${fmt(b.departure.endDate)}`;

          await this.notifications.notifyTourDepartureReminder({
            seekerUserId: b.seeker.userId,
            seekerEmail: b.contactEmail || b.seeker.user.email,
            seekerName: b.contactFirstName || b.seeker.user.firstName || 'there',
            tourTitle: b.tour.title,
            bookingReference: b.bookingReference || b.id.slice(-8).toUpperCase(),
            bookingId: b.id,
            departureDates,
            meetingPoint: b.tour.meetingPoint || b.tour.location || 'TBD',
            daysUntilDeparture: days,
          });

          sent++;
        } catch (err: any) {
          this.logger.error(`Failed to send departure reminder for booking ${b.id}: ${err.message}`);
        }
      }
    }

    if (sent > 0) {
      this.logger.log(`[Queue] sent ${sent} departure reminder(s)`);
    }
    return { sent };
  }
}
