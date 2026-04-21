import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from './stripe.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadService } from '../upload/upload.service';
import { resolveDigitalSource } from '../orders/downloads.service';

/** 7 days — download link embedded in receipt email stays usable through the weekend. */
const ORDER_DOWNLOAD_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly commissionPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly uploadService: UploadService,
  ) {
    this.commissionPercent = Number(this.config.get('STRIPE_PLATFORM_COMMISSION_PERCENT', '15'));
  }

  // ─── Resolve guide's Stripe Connect account from entity ────────────────────

  private async resolveGuideStripeAccount(data: {
    bookingId?: string;
    orderId?: string;
    ticketPurchaseId?: string;
    tourBookingId?: string;
  }): Promise<string | undefined> {
    let guideId: string | undefined;

    if (data.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: data.bookingId },
        include: { service: { select: { guideId: true } } },
      });
      guideId = booking?.service.guideId;
    } else if (data.tourBookingId) {
      const tourBooking = await this.prisma.tourBooking.findUnique({
        where: { id: data.tourBookingId },
        include: { tour: { select: { guideId: true } } },
      });
      guideId = tourBooking?.tour.guideId;
    }
    // For orders/tickets, guide resolution is more complex (multi-seller) — skip for now

    if (!guideId) return undefined;

    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: guideId },
      select: { stripeAccountId: true, stripeOnboardingDone: true },
    });

    return guide?.stripeAccountId && guide?.stripeOnboardingDone
      ? guide.stripeAccountId
      : undefined;
  }

  // ─── Create Payment Intent (REAL Stripe) ───────────────────────────────────

  async createPaymentIntent(data: {
    amount: number;
    currency?: string;
    bookingId?: string;
    orderId?: string;
    ticketPurchaseId?: string;
    tourBookingId?: string;
    paymentType?: 'FULL' | 'DEPOSIT' | 'BALANCE';
    metadata?: Record<string, any>;
  }) {
    const platformFeeRate = this.commissionPercent / 100;
    const guideAmount = data.amount * (1 - platformFeeRate);
    const connectedAccountId = await this.resolveGuideStripeAccount(data);

    // Create real Stripe PaymentIntent
    const { clientSecret, paymentIntentId } = await this.stripeService.createPaymentIntent({
      amount: data.amount,
      currency: data.currency ?? 'usd',
      connectedAccountId,
      metadata: {
        bookingId: data.bookingId ?? '',
        orderId: data.orderId ?? '',
        ticketPurchaseId: data.ticketPurchaseId ?? '',
        tourBookingId: data.tourBookingId ?? '',
        paymentType: data.paymentType ?? 'FULL',
      },
    });

    // Store in our DB
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: data.bookingId,
        orderId: data.orderId,
        ticketPurchaseId: data.ticketPurchaseId,
        tourBookingId: data.tourBookingId,
        stripePaymentIntentId: paymentIntentId,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        platformFee: data.amount * platformFeeRate,
        guideAmount,
        paymentType: data.paymentType ?? 'FULL',
        status: 'PENDING',
        metadata: data.metadata ?? undefined,
      },
    });

    this.logger.log(`Payment created: ${payment.id} → Stripe PI: ${paymentIntentId}`);

    return {
      paymentId: payment.id,
      clientSecret,
      paymentIntentId,
      amount: data.amount,
      currency: data.currency ?? 'USD',
    };
  }

  // ─── Confirm Payment (called by webhook) ───────────────────────────────────

  async confirmPayment(paymentIntentId: string, paymentMethodType?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!payment) {
      this.logger.warn(`Payment not found for PI: ${paymentIntentId}`);
      return;
    }
    if (payment.status === 'SUCCEEDED') return payment; // Idempotent

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED',
        paymentMethod: paymentMethodType ?? 'card',
      },
    });

    // Update related entity status
    if (payment.bookingId) {
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'CONFIRMED' },
      });
    }
    if (payment.orderId) {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'PAID' },
      });
      // Fire-and-forget: generate 7-day download URLs for digital items + send receipt.
      // Any failure here is logged but doesn't fail the webhook — seeker can always
      // regenerate links from the /downloads dashboard.
      this.handleOrderPaid(payment.orderId).catch((err) =>
        this.logger.error(`Order PAID side-effects failed (${payment.orderId}): ${err?.message}`, err?.stack),
      );
    }
    if (payment.tourBookingId) {
      // Clear holdExpiresAt so the hold reaper doesn't release this seat;
      // promote PENDING → DEPOSIT_PAID (or FULLY_PAID if user paid in full).
      await this.prisma.tourBooking.update({
        where: { id: payment.tourBookingId },
        data: {
          status: payment.paymentType === 'DEPOSIT' ? 'DEPOSIT_PAID' : 'FULLY_PAID',
          holdExpiresAt: null,
          ...(payment.paymentType === 'DEPOSIT'
            ? { depositPaidAt: new Date() }
            : { balancePaidAt: new Date() }),
        },
      });

      // Fire-and-forget tour notification (deposit/balance/full)
      this.sendTourPaymentNotification(payment.tourBookingId, payment.paymentType).catch((err) =>
        this.logger.error(`Tour notification failed for booking ${payment.tourBookingId}: ${err.message}`),
      );
    }

    // Confirm event tickets (generate QR codes, increment sold count)
    if (payment.ticketPurchaseId) {
      try {
        const primaryTicket = await this.prisma.ticketPurchase.findUnique({
          where: { id: payment.ticketPurchaseId },
        });
        if (primaryTicket) {
          await this.confirmEventTickets(primaryTicket.purchaseGroupId);
        }
      } catch (err: any) {
        this.logger.error(`Ticket confirmation failed: ${err.message}`, err.stack);
      }
    }

    // Update guide payout account balance
    await this.updateGuideBalance(payment);

    this.logger.log(`Payment confirmed: ${payment.id}`);
    return updated;
  }

  // ─── Event ticket confirmation (QR generation + sold increment) ────────────

  private async confirmEventTickets(purchaseGroupId: string) {
    const tickets = await this.prisma.ticketPurchase.findMany({
      where: { purchaseGroupId },
      include: { tier: { include: { event: { select: { id: true, title: true } } } } },
    });
    if (!tickets.length || tickets[0].status === 'CONFIRMED') return;

    // Dynamic import handles both ESM and CJS module formats
    const qrModule = await import('qrcode');
    const toDataURL = qrModule.toDataURL ?? (qrModule as any).default?.toDataURL;
    if (!toDataURL) {
      this.logger.error('QRCode.toDataURL not found — skipping QR generation');
      // Still confirm tickets without QR codes
      await this.prisma.ticketPurchase.updateMany({
        where: { purchaseGroupId },
        data: { status: 'CONFIRMED' },
      });
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://spiritualcalifornia.com';
    for (const ticket of tickets) {
      // Encode the public verify-ticket URL so scanning takes the door staff
      // straight to the check-in page for this specific ticket.
      const verifyUrl = `${frontendUrl}/verify-ticket/${ticket.id}`;
      const qrCode = await toDataURL(verifyUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#3A3530', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      });
      await this.prisma.ticketPurchase.update({
        where: { id: ticket.id },
        data: { status: 'CONFIRMED', qrCode },
      });
    }

    await this.prisma.eventTicketTier.update({
      where: { id: tickets[0].tierId },
      data: { sold: { increment: tickets.length } },
    });

    this.logger.log(`Confirmed ${tickets.length} event tickets for group ${purchaseGroupId}`);
  }

  // ─── Tour: dispatch confirmation/balance-paid email ────────────────────────

  private async sendTourPaymentNotification(tourBookingId: string, paymentType: string) {
    const booking = await this.prisma.tourBooking.findUnique({
      where: { id: tourBookingId },
      include: {
        tour: { select: { title: true, location: true, guide: { select: { displayName: true } } } },
        roomType: { select: { name: true } },
        departure: { select: { startDate: true, endDate: true } },
        seeker: { select: { userId: true } },
      },
    });
    if (!booking || !booking.seeker) return;

    const fmt = (d: Date | null | undefined) =>
      d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
    const dep = booking.departure;
    const departureDates = dep ? `${fmt(dep.startDate)} – ${fmt(dep.endDate)}` : 'TBD';
    const reference = booking.bookingReference || booking.id.slice(-8).toUpperCase();
    const seekerName = booking.contactFirstName || 'there';
    const seekerEmail = booking.contactEmail;
    if (!seekerEmail) return;

    if (paymentType === 'BALANCE') {
      // Balance payment → "balance paid" email
      await this.notifications.notifyTourBalancePaid({
        seekerUserId: booking.seeker.userId,
        seekerEmail,
        seekerName,
        tourTitle: booking.tour.title,
        bookingReference: reference,
        bookingId: booking.id,
        departureDates,
        totalPaid: `$${Number(booking.totalAmount).toLocaleString()}`,
      });
    } else {
      // Deposit or Full payment → "deposit/booking confirmed" email
      const deposit = Number(booking.depositAmount ?? booking.totalAmount);
      const balance = Number(booking.balanceAmount ?? 0);
      const isPaidInFull = paymentType === 'FULL' || balance === 0;
      await this.notifications.notifyTourDepositConfirmed({
        seekerUserId: booking.seeker.userId,
        seekerEmail,
        seekerName,
        tourTitle: booking.tour.title,
        bookingReference: reference,
        bookingId: booking.id,
        departureDates,
        location: booking.tour.location || 'TBD',
        travelers: booking.travelers,
        roomType: booking.roomType.name,
        depositPaid: `$${deposit.toLocaleString()}`,
        balanceDue: `$${balance.toLocaleString()}`,
        balanceDueDate: booking.balanceDueAt ? fmt(booking.balanceDueAt) : 'TBD',
        guideName: booking.tour.guide.displayName,
        isPaidInFull,
      });
    }
  }

  // ─── Order: generate digital download URLs + send receipt ─────────────────

  /**
   * Runs right after an order is flipped to PAID. Two side-effects:
   *   1. For every digital OrderItem, pre-generate a 7-day signed S3 URL and
   *      cache it on the row (so the receipt email + confirmation screen can
   *      link directly — no "check your dashboard" friction).
   *   2. Send the order-confirmation email with those links inline.
   *
   * Failures are logged but never thrown — seeker can always regenerate links
   * from /downloads, and order is already paid.
   */
  private async handleOrderPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seeker: { select: { userId: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, type: true, fileS3Key: true, digitalFiles: true } },
          },
        },
      },
    });
    if (!order) {
      this.logger.warn(`handleOrderPaid: order ${orderId} not found`);
      return;
    }

    // 1. Generate download URLs for digital items
    const expiresAt = new Date(Date.now() + ORDER_DOWNLOAD_URL_TTL_SECONDS * 1000);
    const digitalLinks: Array<{ name: string; url: string }> = [];

    for (const item of order.items) {
      if (item.product.type !== 'DIGITAL') continue;
      const source = resolveDigitalSource(item.product);
      if (!source) {
        this.logger.warn(
          `Digital product ${item.product.id} has no downloadable file — skipping URL generation`,
        );
        continue;
      }
      try {
        let url: string;
        if (source.kind === 's3') {
          const safeName = source.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          const ext = source.filename.includes('.') ? '' : `.${source.key.split('.').pop() || 'zip'}`;
          url = await this.uploadService.getPresignedDownloadUrl(
            source.key,
            ORDER_DOWNLOAD_URL_TTL_SECONDS,
            `${safeName}${ext}`,
          );
        } else {
          // Legacy base64 data URL — store verbatim. Small files download fine;
          // large ones should be re-uploaded by the guide via the S3 flow.
          url = source.url;
        }
        await this.prisma.orderItem.update({
          where: { id: item.id },
          data: { downloadUrl: url, downloadUrlExpiresAt: expiresAt },
        });
        digitalLinks.push({ name: item.product.name, url });
      } catch (err: any) {
        this.logger.error(
          `Download URL gen failed for orderItem ${item.id}: ${err?.message}`,
          err?.stack,
        );
      }
    }

    // 2. Send the order-confirmation email (with download links embedded)
    if (order.contactEmail && order.seeker) {
      const fullName = [order.contactFirstName, order.contactLastName].filter(Boolean).join(' ').trim();
      try {
        await this.notifications.notifyOrderConfirmed({
          userId: order.seeker.userId,
          email: order.contactEmail,
          name: fullName || 'there',
          orderId: order.id,
          items: order.items.map((i) => ({
            name: i.product.name,
            qty: i.quantity,
            price: `$${(Number(i.unitPrice) * i.quantity).toFixed(2)}`,
          })),
          total: `$${Number(order.totalAmount).toFixed(2)}`,
          hasDigital: digitalLinks.length > 0,
          digitalDownloads: digitalLinks,
        });
      } catch (err: any) {
        this.logger.error(
          `notifyOrderConfirmed failed for order ${order.id}: ${err?.message}`,
          err?.stack,
        );
      }
    }
  }

  // ─── Update Guide Balance ──────────────────────────────────────────────────

  private async updateGuideBalance(payment: any) {
    const guideId = await this.resolveGuideIdFromPayment(payment);
    if (!guideId) return;

    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: guideId },
      select: { stripeAccountId: true },
    });

    await this.prisma.payoutAccount.upsert({
      where: { guideId },
      update: {
        availableBalance: { increment: Number(payment.guideAmount) },
        totalEarned: { increment: Number(payment.guideAmount) },
      },
      create: {
        guideId,
        // Use guide's actual Stripe account or a unique placeholder (unique constraint on stripeAccountId)
        stripeAccountId: guide?.stripeAccountId || `pending-${guideId}`,
        availableBalance: Number(payment.guideAmount),
        totalEarned: Number(payment.guideAmount),
      },
    });
  }

  private async resolveGuideIdFromPayment(payment: any): Promise<string | undefined> {
    if (payment.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: { service: { select: { guideId: true } } },
      });
      return booking?.service.guideId;
    }
    if (payment.tourBookingId) {
      const tb = await this.prisma.tourBooking.findUnique({
        where: { id: payment.tourBookingId },
        include: { tour: { select: { guideId: true } } },
      });
      return tb?.tour.guideId;
    }
    if (payment.ticketPurchaseId) {
      const tp = await this.prisma.ticketPurchase.findUnique({
        where: { id: payment.ticketPurchaseId },
        include: { tier: { include: { event: { select: { guideId: true } } } } },
      });
      return tp?.tier.event.guideId;
    }
    return undefined;
  }

  // ─── Handle Payment Failure ────────────────────────────────────────────────

  async failPayment(paymentIntentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
    this.logger.warn(`Payment failed: ${payment.id}`);
  }

  // ─── Get Payment by ID ─────────────────────────────────────────────────────

  async findOne(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  // ─── Refund (Real Stripe) ──────────────────────────────────────────────────

  async refund(paymentId: string, amount?: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCEEDED') throw new BadRequestException('Can only refund succeeded payments');

    const refundAmount = amount ?? Number(payment.amount);

    // Real Stripe refund
    const refund = await this.stripeService.createRefund(
      payment.stripePaymentIntentId,
      refundAmount,
    );

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: refundAmount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAmount: refundAmount,
        stripeRefundId: refund.id,
      },
    });
  }

  // ─── Stripe Webhook Handler (REAL signature verification) ──────────────────

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    let event;
    try {
      event = this.stripeService.constructEvent(rawBody, signature);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Webhook received: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        const methodType = pi.payment_method_types?.[0] ?? 'card';
        await this.confirmPayment(pi.id, methodType);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        await this.failPayment(pi.id);
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        if (session.payment_intent) {
          await this.confirmPayment(session.payment_intent);
        }
        break;
      }
      case 'account.updated': {
        // Stripe Connect account updated — check onboarding status
        const account = event.data.object as any;
        if (account.charges_enabled && account.details_submitted) {
          await this.prisma.guideProfile.updateMany({
            where: { stripeAccountId: account.id },
            data: { stripeOnboardingDone: true },
          });
          this.logger.log(`Connect account ${account.id} onboarding complete`);
        }
        break;
      }
      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }

    return { received: true };
  }

  // ─── Stripe Connect Onboarding (for Guides) ───────────────────────────────

  async createConnectOnboarding(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!guide) throw new NotFoundException('Guide profile not found');

    // If already has account, create new onboarding link
    if (guide.stripeAccountId && guide.stripeAccountId !== 'pending-setup') {
      const status = await this.stripeService.getConnectAccountStatus(guide.stripeAccountId);
      if (status.detailsSubmitted) {
        // Already onboarded — return dashboard link
        const dashboardUrl = await this.stripeService.createConnectLoginLink(guide.stripeAccountId);
        return { alreadyOnboarded: true, dashboardUrl, status };
      }
      // Resume onboarding
      const { onboardingUrl } = await this.stripeService.createConnectAccount({
        email: guide.user.email,
        guideId: guide.id,
        displayName: guide.displayName,
      });
      return { onboardingUrl };
    }

    // Create new Connect account
    const { accountId, onboardingUrl } = await this.stripeService.createConnectAccount({
      email: guide.user.email,
      guideId: guide.id,
      displayName: guide.displayName,
    });

    // Save to DB
    await this.prisma.guideProfile.update({
      where: { id: guide.id },
      data: { stripeAccountId: accountId },
    });

    // Create payout account record
    await this.prisma.payoutAccount.upsert({
      where: { guideId: guide.id },
      update: { stripeAccountId: accountId },
      create: { guideId: guide.id, stripeAccountId: accountId },
    });

    return { accountId, onboardingUrl };
  }

  // ─── Get Connect Account Status ────────────────────────────────────────────

  async getConnectStatus(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new NotFoundException('Guide profile not found');

    if (!guide.stripeAccountId || guide.stripeAccountId === 'pending-setup') {
      return { connected: false, chargesEnabled: false, payoutsEnabled: false };
    }

    const status = await this.stripeService.getConnectAccountStatus(guide.stripeAccountId);
    return { connected: true, ...status };
  }

  // ─── Payout Request (Guide Cashout) ────────────────────────────────────────

  async requestPayout(userId: string, amount: number) {
    if (amount < 10) throw new BadRequestException('Minimum payout amount is $10');

    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new NotFoundException('Guide profile not found');

    const payoutAccount = await this.prisma.payoutAccount.findUnique({ where: { guideId: guide.id } });
    if (!payoutAccount) throw new BadRequestException('No payout account found. Set up Stripe Connect first.');
    if (Number(payoutAccount.availableBalance) < amount) throw new BadRequestException('Insufficient available balance');

    // Create payout request + decrement balance atomically
    const payout = await this.prisma.payoutRequest.create({
      data: {
        guideId: guide.id,
        payoutAccountId: payoutAccount.id,
        amount,
        status: 'PENDING',
      },
    });

    await this.prisma.payoutAccount.update({
      where: { id: payoutAccount.id },
      data: { availableBalance: { decrement: amount } },
    });

    this.logger.log(`Payout requested: ${payout.id} for $${amount} by guide ${guide.id}`);
    return payout;
  }

  // ─── Process Payout (Admin triggers actual Stripe transfer) ────────────────

  async processPayout(payoutRequestId: string) {
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutRequestId },
      include: { payoutAccount: true, guide: { select: { stripeAccountId: true, stripeOnboardingDone: true, displayName: true } } },
    });
    if (!payout) throw new NotFoundException('Payout request not found');
    if (payout.status !== 'PENDING') throw new BadRequestException(`Payout is already ${payout.status}`);

    if (!payout.guide.stripeAccountId || !payout.guide.stripeOnboardingDone) {
      throw new BadRequestException('Guide has not completed Stripe Connect onboarding');
    }

    // Update status to PROCESSING
    await this.prisma.payoutRequest.update({
      where: { id: payout.id },
      data: { status: 'PROCESSING' },
    });

    try {
      // Execute real Stripe transfer to guide's connected account
      const transfer = await this.stripeService.createTransfer({
        amount: Number(payout.amount),
        connectedAccountId: payout.guide.stripeAccountId,
        description: `Payout ${payout.id} for ${payout.guide.displayName}`,
      });

      // Mark as completed
      await this.prisma.payoutRequest.update({
        where: { id: payout.id },
        data: { status: 'COMPLETED', stripePayoutId: transfer.id, processedAt: new Date() },
      });

      await this.prisma.payoutAccount.update({
        where: { id: payout.payoutAccountId },
        data: { totalPaidOut: { increment: Number(payout.amount) } },
      });

      this.logger.log(`Payout completed: ${payout.id} → Stripe transfer ${transfer.id}`);
      return { status: 'COMPLETED', transferId: transfer.id };
    } catch (err: any) {
      // Stripe transfer failed — refund the balance back
      await this.prisma.payoutRequest.update({
        where: { id: payout.id },
        data: { status: 'FAILED' },
      });

      await this.prisma.payoutAccount.update({
        where: { id: payout.payoutAccountId },
        data: { availableBalance: { increment: Number(payout.amount) } },
      });

      this.logger.error(`Payout failed: ${payout.id} — ${err.message}`);
      throw new BadRequestException(`Stripe transfer failed: ${err.message}`);
    }
  }

  // ─── Get Guide Payout History ──────────────────────────────────────────────

  async getGuidePayoutHistory(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new NotFoundException('Guide profile not found');

    return this.prisma.payoutRequest.findMany({
      where: { guideId: guide.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, amount: true, currency: true, status: true,
        stripePayoutId: true, processedAt: true, createdAt: true,
      },
    });
  }

  // ─── Get Guide Earnings ────────────────────────────────────────────────────

  async getGuideEarnings(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new NotFoundException('Guide profile not found');

    const payoutAccount = await this.prisma.payoutAccount.findUnique({ where: { guideId: guide.id } });

    const recentPayments = await this.prisma.payment.findMany({
      where: {
        status: 'SUCCEEDED',
        OR: [
          { booking: { service: { guideId: guide.id } } },
          { tourBooking: { tour: { guideId: guide.id } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, amount: true, guideAmount: true, platformFee: true, paymentType: true,
        paymentMethod: true, createdAt: true, status: true,
      },
    });

    return {
      balance: {
        available: Number(payoutAccount?.availableBalance ?? 0),
        pending: Number(payoutAccount?.pendingBalance ?? 0),
        totalEarned: Number(payoutAccount?.totalEarned ?? 0),
        totalPaidOut: Number(payoutAccount?.totalPaidOut ?? 0),
      },
      recentPayments,
      stripeConnected: !!guide.stripeAccountId && guide.stripeOnboardingDone,
    };
  }
}
