import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly commissionPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly config: ConfigService,
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
    }
    if (payment.tourBookingId) {
      await this.prisma.tourBooking.update({
        where: { id: payment.tourBookingId },
        data: {
          status: payment.paymentType === 'DEPOSIT' ? 'DEPOSIT_PAID' : 'FULLY_PAID',
          ...(payment.paymentType === 'DEPOSIT' ? { depositPaidAt: new Date() } : { balancePaidAt: new Date() }),
        },
      });
    }

    // Update guide payout account balance
    await this.updateGuideBalance(payment);

    this.logger.log(`Payment confirmed: ${payment.id}`);
    return updated;
  }

  // ─── Update Guide Balance ──────────────────────────────────────────────────

  private async updateGuideBalance(payment: any) {
    let guideId: string | undefined;

    if (payment.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: { service: { select: { guideId: true } } },
      });
      guideId = booking?.service.guideId;
    } else if (payment.tourBookingId) {
      const tb = await this.prisma.tourBooking.findUnique({
        where: { id: payment.tourBookingId },
        include: { tour: { select: { guideId: true } } },
      });
      guideId = tb?.tour.guideId;
    }

    if (!guideId) return;

    await this.prisma.payoutAccount.upsert({
      where: { guideId },
      update: {
        pendingBalance: { increment: Number(payment.guideAmount) },
        totalEarned: { increment: Number(payment.guideAmount) },
      },
      create: {
        guideId,
        stripeAccountId: 'pending-setup',
        pendingBalance: Number(payment.guideAmount),
        totalEarned: Number(payment.guideAmount),
      },
    });
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
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new NotFoundException('Guide profile not found');

    const payoutAccount = await this.prisma.payoutAccount.findUnique({ where: { guideId: guide.id } });
    if (!payoutAccount) throw new BadRequestException('No payout account found. Set up Stripe Connect first.');
    if (Number(payoutAccount.availableBalance) < amount) throw new BadRequestException('Insufficient available balance');

    const payout = await this.prisma.payoutRequest.create({
      data: {
        guideId: guide.id,
        payoutAccountId: payoutAccount.id,
        amount,
        status: 'PENDING',
      },
    });

    // In production, trigger actual Stripe payout/transfer here
    // For now, mark as processing
    await this.prisma.payoutAccount.update({
      where: { id: payoutAccount.id },
      data: {
        availableBalance: { decrement: amount },
      },
    });

    this.logger.log(`Payout requested: ${payout.id} for $${amount} by guide ${guide.id}`);
    return payout;
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
