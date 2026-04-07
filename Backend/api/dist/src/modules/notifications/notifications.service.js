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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const email_service_1 = require("./email.service");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    prisma;
    emailService;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(prisma, emailService) {
        this.prisma = prisma;
        this.emailService = emailService;
    }
    async create(userId, type, title, body, data) {
        return this.prisma.notification.create({
            data: { userId, type, title, body, data: data ?? undefined },
        });
    }
    async findByUser(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [notifications, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where: { userId } }),
            this.prisma.notification.count({ where: { userId, isRead: false } }),
        ]);
        return { notifications, unreadCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
    async markAsRead(userId, notificationId) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }
    async markAllAsRead(userId) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
    async notifyBookingConfirmed(booking) {
        await this.create(booking.seekerUserId, 'BOOKING_CONFIRMED', 'Session Confirmed', `Your ${booking.serviceName} with ${booking.guideName} is confirmed.`);
        await this.emailService.sendBookingConfirmation(booking.seekerEmail, {
            seekerName: booking.seekerName,
            guideName: booking.guideName,
            serviceName: booking.serviceName,
            dateTime: booking.dateTime,
            amount: booking.amount,
        });
    }
    async notifyOrderConfirmed(order) {
        await this.create(order.userId, 'ORDER_PLACED', 'Order Confirmed', `Your order #${order.orderId.slice(-8).toUpperCase()} has been confirmed.`);
        await this.emailService.sendOrderConfirmation(order.email, order);
    }
    async notifyReviewRequest(data) {
        await this.create(data.userId, 'REVIEW_RECEIVED', 'Share Your Experience', `How was your session with ${data.guideName}?`, { bookingId: data.bookingId });
        await this.emailService.sendReviewRequest(data.email, data);
    }
    async notifyVerificationApproved(data) {
        await this.create(data.userId, 'VERIFICATION_APPROVED', 'Profile Verified!', 'Your profile is now live on Spiritual California.');
        await this.emailService.sendVerificationApproved(data.email, data.guideName);
    }
    async notifyTourDepositConfirmed(data) {
        const title = data.isPaidInFull ? 'Tour Booking Confirmed' : 'Tour Spot Reserved';
        const body = data.isPaidInFull
            ? `Your spot on "${data.tourTitle}" is fully paid and confirmed.`
            : `Your deposit for "${data.tourTitle}" was received. Balance of ${data.balanceDue} due by ${data.balanceDueDate}.`;
        await this.create(data.seekerUserId, 'BOOKING_CONFIRMED', title, body, {
            tourBookingId: data.bookingId,
            bookingReference: data.bookingReference,
        });
        await this.emailService.sendTourDepositConfirmation(data.seekerEmail, data);
    }
    async notifyTourBalancePaid(data) {
        await this.create(data.seekerUserId, 'PAYMENT_RECEIVED', 'Tour Balance Paid', `Your booking for "${data.tourTitle}" is now fully paid.`, { tourBookingId: data.bookingId });
        await this.emailService.sendTourBalancePaid(data.seekerEmail, data);
    }
    async notifyTourBalanceReminder(data) {
        await this.create(data.seekerUserId, 'BOOKING_REMINDER', `Balance Due in ${data.daysUntilDue} Day${data.daysUntilDue === 1 ? '' : 's'}`, `Your remaining balance for "${data.tourTitle}" of ${data.balanceDue} is due ${data.balanceDueDate}.`, { tourBookingId: data.bookingId });
        await this.emailService.sendTourBalanceReminder(data.seekerEmail, data);
    }
    async notifyTourDepartureReminder(data) {
        const title = data.daysUntilDeparture <= 1
            ? 'Your Journey Begins Tomorrow!'
            : `Your Journey Begins in ${data.daysUntilDeparture} Days`;
        await this.create(data.seekerUserId, 'BOOKING_REMINDER', title, `${data.tourTitle} departs ${data.departureDates}. Meeting at ${data.meetingPoint}.`, { tourBookingId: data.bookingId });
        await this.emailService.sendTourDepartureReminder(data.seekerEmail, data);
    }
    async notifyTourCancelled(data) {
        const refundLabel = data.refundTier === 'FULL'
            ? `Full refund of ${data.refundAmount} will be processed.`
            : data.refundTier === 'HALF'
                ? `50% refund of ${data.refundAmount} will be processed.`
                : 'No refund is available per the cancellation policy.';
        await this.create(data.seekerUserId, 'BOOKING_CANCELLED', 'Tour Booking Cancelled', `Your booking for "${data.tourTitle}" has been cancelled. ${refundLabel}`, { bookingReference: data.bookingReference });
        await this.emailService.sendTourCancellation(data.seekerEmail, data);
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map