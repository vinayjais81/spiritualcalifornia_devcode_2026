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

  async notifyOrderConfirmed(order: {
    userId: string;
    email: string;
    name: string;
    orderId: string;
    items: Array<{ name: string; qty: number; price: string }>;
    total: string;
    hasDigital: boolean;
    /** Per-item signed S3 URLs so the email can link directly to the file */
    digitalDownloads?: Array<{ name: string; url: string }>;
  }) {
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

  // ─── Payouts v2 ────────────────────────────────────────────────────────────

  async notifyPayoutCompleted(data: {
    userId: string;
    email: string;
    guideName: string;
    amount: string;
    transferId: string;
    earningsUrl: string;
  }) {
    await this.create(
      data.userId,
      'PAYOUT_PROCESSED',
      'Payout Sent',
      `Your payout of ${data.amount} is on its way.`,
      { transferId: data.transferId },
    );
    await this.emailService.sendPayoutNotification(data.email, {
      subject: `Payout Sent — ${data.amount}`,
      headline: 'Payout Sent ✓',
      body: `Hi ${data.guideName},\n\nYour payout of ${data.amount} has been sent to your bank via Stripe. Most banks deposit within 1–2 business days.\n\nReference: ${data.transferId}`,
      ctaLabel: 'View Earnings',
      ctaUrl: data.earningsUrl,
    });
  }

  async notifyPayoutFailed(data: {
    userId: string;
    email: string;
    guideName: string;
    amount: string;
    reason: string;
    earningsUrl: string;
  }) {
    await this.create(
      data.userId,
      'PAYOUT_PROCESSED',
      'Payout Failed',
      `Your payout of ${data.amount} could not be sent — your balance has been restored.`,
    );
    await this.emailService.sendPayoutNotification(data.email, {
      subject: `Payout Failed — ${data.amount}`,
      headline: 'Payout Failed',
      body: `Hi ${data.guideName},\n\nYour payout of ${data.amount} could not be sent. Stripe reported: "${data.reason}". Your balance has been restored — please check your Stripe Connect dashboard for details (often: missing bank info or KYC requirement) and try again.`,
      ctaLabel: 'Open Stripe Dashboard',
      ctaUrl: data.earningsUrl,
    });
  }

  async notifyPayoutHeld(data: {
    userId: string;
    email: string;
    guideName: string;
    reason: string;
    supportEmail: string;
  }) {
    await this.create(
      data.userId,
      'PAYOUT_PROCESSED',
      'Payout Hold Placed',
      'Payouts on your account are temporarily on hold pending review.',
    );
    await this.emailService.sendPayoutNotification(data.email, {
      subject: 'Payouts Temporarily on Hold',
      headline: 'Payouts on Hold',
      body: `Hi ${data.guideName},\n\nWe've temporarily placed your payouts on hold while we review your account. Reason: ${data.reason}.\n\nIf you have questions, reply to this email or write to ${data.supportEmail}.`,
    });
  }

  async notifyPayoutEarningsCleared(data: {
    userId: string;
    email: string;
    guideName: string;
    amount: string;
    earningsUrl: string;
  }) {
    await this.create(
      data.userId,
      'PAYMENT_RECEIVED',
      'Earnings Available',
      `${data.amount} cleared and is available for payout.`,
    );
    await this.emailService.sendPayoutNotification(data.email, {
      subject: `${data.amount} Available for Payout`,
      headline: 'Earnings Cleared ✦',
      body: `Hi ${data.guideName},\n\n${data.amount} of your recent earnings has cleared the holding period and is now available for payout.\n\nMinimum payout amount: $50.`,
      ctaLabel: 'Request Payout',
      ctaUrl: data.earningsUrl,
    });
  }

  // ─── Soul Tour: Deposit / Booking Confirmed ────────────────────────────────

  async notifyTourDepositConfirmed(data: {
    seekerUserId: string;
    seekerEmail: string;
    seekerName: string;
    tourTitle: string;
    bookingReference: string;
    bookingId: string;
    departureDates: string;
    location: string;
    travelers: number;
    roomType: string;
    depositPaid: string;
    balanceDue: string;
    balanceDueDate: string;
    guideName: string;
    isPaidInFull: boolean;
  }) {
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

  // ─── Soul Tour: Balance Paid ───────────────────────────────────────────────

  async notifyTourBalancePaid(data: {
    seekerUserId: string;
    seekerEmail: string;
    seekerName: string;
    tourTitle: string;
    bookingReference: string;
    bookingId: string;
    departureDates: string;
    totalPaid: string;
  }) {
    await this.create(
      data.seekerUserId,
      'PAYMENT_RECEIVED',
      'Tour Balance Paid',
      `Your booking for "${data.tourTitle}" is now fully paid.`,
      { tourBookingId: data.bookingId },
    );
    await this.emailService.sendTourBalancePaid(data.seekerEmail, data);
  }

  // ─── Soul Tour: Balance Reminder ───────────────────────────────────────────

  async notifyTourBalanceReminder(data: {
    seekerUserId: string;
    seekerEmail: string;
    seekerName: string;
    tourTitle: string;
    bookingReference: string;
    bookingId: string;
    departureDates: string;
    balanceDue: string;
    balanceDueDate: string;
    daysUntilDue: number;
  }) {
    await this.create(
      data.seekerUserId,
      'BOOKING_REMINDER',
      `Balance Due in ${data.daysUntilDue} Day${data.daysUntilDue === 1 ? '' : 's'}`,
      `Your remaining balance for "${data.tourTitle}" of ${data.balanceDue} is due ${data.balanceDueDate}.`,
      { tourBookingId: data.bookingId },
    );
    await this.emailService.sendTourBalanceReminder(data.seekerEmail, data);
  }

  // ─── Soul Tour: Departure Reminder ─────────────────────────────────────────

  async notifyTourDepartureReminder(data: {
    seekerUserId: string;
    seekerEmail: string;
    seekerName: string;
    tourTitle: string;
    bookingReference: string;
    bookingId: string;
    departureDates: string;
    meetingPoint: string;
    daysUntilDeparture: number;
  }) {
    const title =
      data.daysUntilDeparture <= 1
        ? 'Your Journey Begins Tomorrow!'
        : `Your Journey Begins in ${data.daysUntilDeparture} Days`;
    await this.create(
      data.seekerUserId,
      'BOOKING_REMINDER',
      title,
      `${data.tourTitle} departs ${data.departureDates}. Meeting at ${data.meetingPoint}.`,
      { tourBookingId: data.bookingId },
    );
    await this.emailService.sendTourDepartureReminder(data.seekerEmail, data);
  }

  // ─── Soul Tour: Cancellation ───────────────────────────────────────────────

  async notifyTourCancelled(data: {
    seekerUserId: string;
    seekerEmail: string;
    seekerName: string;
    tourTitle: string;
    bookingReference: string;
    refundAmount: string;
    refundTier: 'FULL' | 'HALF' | 'NONE';
    cancellationReason: string | null;
  }) {
    const refundLabel =
      data.refundTier === 'FULL'
        ? `Full refund of ${data.refundAmount} will be processed.`
        : data.refundTier === 'HALF'
          ? `50% refund of ${data.refundAmount} will be processed.`
          : 'No refund is available per the cancellation policy.';
    await this.create(
      data.seekerUserId,
      'BOOKING_CANCELLED',
      'Tour Booking Cancelled',
      `Your booking for "${data.tourTitle}" has been cancelled. ${refundLabel}`,
      { bookingReference: data.bookingReference },
    );
    await this.emailService.sendTourCancellation(data.seekerEmail, data);
  }
}
