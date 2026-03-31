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
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map