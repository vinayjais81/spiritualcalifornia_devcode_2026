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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TourTasksQueue_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TourTasksQueue = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("bullmq");
const prisma_service_1 = require("../../database/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const soul_tours_service_1 = require("./soul-tours.service");
const QUEUE_NAME = 'tour-tasks';
const JOB_HOLD_REAPER = 'tour-hold-reaper';
const JOB_BALANCE_REMINDER = 'tour-balance-reminder';
const JOB_DEPARTURE_REMINDER = 'tour-departure-reminder';
const CRON_HOLD_REAPER = '*/5 * * * *';
const CRON_BALANCE_REMINDER = '0 9 * * *';
const CRON_DEPARTURE_REMINDER = '0 9 * * *';
const BALANCE_REMINDER_DAYS = [14, 7, 1];
const DEPARTURE_REMINDER_DAYS = [7, 1];
let TourTasksQueue = TourTasksQueue_1 = class TourTasksQueue {
    config;
    prisma;
    notifications;
    soulTours;
    logger = new common_1.Logger(TourTasksQueue_1.name);
    queue = null;
    worker = null;
    redisHost;
    redisPort;
    redisPassword;
    enabled;
    constructor(config, prisma, notifications, soulTours) {
        this.config = config;
        this.prisma = prisma;
        this.notifications = notifications;
        this.soulTours = soulTours;
        this.enabled = this.config.get('TOUR_TASKS_ENABLED', 'true') !== 'false';
        this.redisHost = this.config.get('REDIS_HOST', 'localhost');
        this.redisPort = Number(this.config.get('REDIS_PORT', 6379));
        this.redisPassword = this.config.get('REDIS_PASSWORD');
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
            this.queue = new bullmq_1.Queue(QUEUE_NAME, { connection });
            this.worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
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
            }, { connection, concurrency: 2 });
            this.worker.on('completed', (job) => this.logger.log(`[Queue] ${job.name} completed`));
            this.worker.on('failed', (job, err) => this.logger.error(`[Queue] ${job?.name} failed: ${err.message}`));
            await this.queue.add(JOB_HOLD_REAPER, {}, {
                repeat: { pattern: CRON_HOLD_REAPER },
                removeOnComplete: { count: 50 },
                removeOnFail: { count: 50 },
            });
            await this.queue.add(JOB_BALANCE_REMINDER, {}, {
                repeat: { pattern: CRON_BALANCE_REMINDER },
                removeOnComplete: { count: 50 },
                removeOnFail: { count: 50 },
            });
            await this.queue.add(JOB_DEPARTURE_REMINDER, {}, {
                repeat: { pattern: CRON_DEPARTURE_REMINDER },
                removeOnComplete: { count: 50 },
                removeOnFail: { count: 50 },
            });
            this.logger.log(`[Queue] tour-tasks worker started — hold-reaper(${CRON_HOLD_REAPER}), balance-reminder(${CRON_BALANCE_REMINDER}), departure-reminder(${CRON_DEPARTURE_REMINDER})`);
        }
        catch (err) {
            this.logger.error(`[Queue] failed to start tour-tasks queue: ${err.message}. Tour notifications and hold reaping will not run until Redis is available.`);
            this.queue = null;
            this.worker = null;
        }
    }
    async onModuleDestroy() {
        try {
            await this.worker?.close();
            await this.queue?.close();
        }
        catch (err) {
            this.logger.error(`[Queue] error closing tour-tasks queue: ${err.message}`);
        }
    }
    async runHoldReaper() {
        const result = await this.soulTours.releaseExpiredHolds();
        return { released: result.released };
    }
    async runBalanceReminders() {
        const now = new Date();
        let sent = 0;
        for (const days of BALANCE_REMINDER_DAYS) {
            const windowStart = new Date(now);
            windowStart.setDate(windowStart.getDate() + days);
            windowStart.setHours(0, 0, 0, 0);
            const windowEnd = new Date(windowStart);
            windowEnd.setDate(windowEnd.getDate() + 1);
            const candidates = await this.prisma.tourBooking.findMany({
                where: {
                    status: 'DEPOSIT_PAID',
                    balanceDueAt: { gte: windowStart, lt: windowEnd },
                    balanceReminderSentAt: null,
                },
                include: {
                    tour: { select: { title: true } },
                    departure: { select: { startDate: true, endDate: true } },
                    seeker: { select: { userId: true, user: { select: { email: true, firstName: true } } } },
                },
            });
            for (const b of candidates) {
                if (!b.balanceDueAt || !b.seeker?.user)
                    continue;
                try {
                    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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
                    await this.prisma.tourBooking.update({
                        where: { id: b.id },
                        data: { balanceReminderSentAt: new Date() },
                    });
                    sent++;
                }
                catch (err) {
                    this.logger.error(`Failed to send balance reminder for booking ${b.id}: ${err.message}`);
                }
            }
        }
        if (sent > 0) {
            this.logger.log(`[Queue] sent ${sent} balance reminder(s)`);
        }
        return { sent };
    }
    async runDepartureReminders() {
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
                if (!b.departure || !b.seeker?.user)
                    continue;
                try {
                    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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
                }
                catch (err) {
                    this.logger.error(`Failed to send departure reminder for booking ${b.id}: ${err.message}`);
                }
            }
        }
        if (sent > 0) {
            this.logger.log(`[Queue] sent ${sent} departure reminder(s)`);
        }
        return { sent };
    }
};
exports.TourTasksQueue = TourTasksQueue;
exports.TourTasksQueue = TourTasksQueue = TourTasksQueue_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => soul_tours_service_1.SoulToursService))),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        soul_tours_service_1.SoulToursService])
], TourTasksQueue);
//# sourceMappingURL=tour-tasks.queue.js.map