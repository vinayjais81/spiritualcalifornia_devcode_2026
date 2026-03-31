import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from './email.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Create In-App Notification ────────────────────────────────────────────

  async create(userId: string, type: NotificationType, title: string, body: string, data?: Record<string, any>) {
    return this.prisma.notification.create({
      data: { userId, type, title, body, data: data ?? undefined },
    });
  }

  // ─── Get User's Notifications ──────────────────────────────────────────────

  async findByUser(userId: string, page = 1, limit = 20) {
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

  // ─── Mark as Read ──────────────────────────────────────────────────────────

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // ─── High-Level Notification Triggers ──────────────────────────────────────

  async notifyBookingConfirmed(booking: { seekerUserId: string; seekerEmail: string; seekerName: string; guideName: string; serviceName: string; dateTime: string; amount: string }) {
    // In-app
    await this.create(booking.seekerUserId, 'BOOKING_CONFIRMED', 'Session Confirmed', `Your ${booking.serviceName} with ${booking.guideName} is confirmed.`);
    // Email
    await this.emailService.sendBookingConfirmation(booking.seekerEmail, {
      seekerName: booking.seekerName,
      guideName: booking.guideName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      amount: booking.amount,
    });
  }

  async notifyOrderConfirmed(order: { userId: string; email: string; name: string; orderId: string; items: Array<{ name: string; qty: number; price: string }>; total: string; hasDigital: boolean }) {
    await this.create(order.userId, 'ORDER_PLACED', 'Order Confirmed', `Your order #${order.orderId.slice(-8).toUpperCase()} has been confirmed.`);
    await this.emailService.sendOrderConfirmation(order.email, order);
  }

  async notifyReviewRequest(data: { userId: string; email: string; seekerName: string; guideName: string; serviceName: string; bookingId: string }) {
    await this.create(data.userId, 'REVIEW_RECEIVED', 'Share Your Experience', `How was your session with ${data.guideName}?`, { bookingId: data.bookingId });
    await this.emailService.sendReviewRequest(data.email, data);
  }

  async notifyVerificationApproved(data: { userId: string; email: string; guideName: string }) {
    await this.create(data.userId, 'VERIFICATION_APPROVED', 'Profile Verified!', 'Your profile is now live on Spiritual California.');
    await this.emailService.sendVerificationApproved(data.email, data.guideName);
  }
}
