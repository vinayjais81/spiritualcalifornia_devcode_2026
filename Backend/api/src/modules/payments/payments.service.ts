import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create Payment Intent (stub — replace with real Stripe) ───────────────

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
    // [STUB] In production, call Stripe:
    // const paymentIntent = await stripe.paymentIntents.create({ amount, currency, metadata });
    const stubPaymentIntentId = `pi_stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const platformFeeRate = 0.15; // 15% platform fee
    const guideAmount = data.amount * (1 - platformFeeRate);

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: data.bookingId,
        orderId: data.orderId,
        ticketPurchaseId: data.ticketPurchaseId,
        tourBookingId: data.tourBookingId,
        stripePaymentIntentId: stubPaymentIntentId,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        platformFee: data.amount * platformFeeRate,
        guideAmount,
        paymentType: data.paymentType ?? 'FULL',
        status: 'PENDING',
        metadata: data.metadata ?? undefined,
      },
    });

    return {
      paymentId: payment.id,
      clientSecret: `${stubPaymentIntentId}_secret_stub`, // [STUB] Real Stripe returns this
      amount: data.amount,
      currency: data.currency ?? 'USD',
    };
  }

  // ─── Confirm Payment (webhook simulation) ──────────────────────────────────

  async confirmPayment(paymentIntentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCEEDED' },
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

    return updated;
  }

  // ─── Get Payment by ID ─────────────────────────────────────────────────────

  async findOne(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  // ─── Refund ────────────────────────────────────────────────────────────────

  async refund(paymentId: string, amount?: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCEEDED') throw new BadRequestException('Can only refund succeeded payments');

    const refundAmount = amount ?? Number(payment.amount);
    // [STUB] In production: const refund = await stripe.refunds.create({ payment_intent, amount });

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: refundAmount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAmount: refundAmount,
        stripeRefundId: `re_stub_${Date.now()}`,
      },
    });
  }

  // ─── Stripe Webhook Handler (stub) ─────────────────────────────────────────

  async handleStripeWebhook(payload: any) {
    // [STUB] In production:
    // 1. Verify webhook signature with stripe.webhooks.constructEvent()
    // 2. Handle event types: payment_intent.succeeded, checkout.session.completed, etc.
    // 3. Call confirmPayment() or refund() based on event type
    const eventType = payload?.type;
    const paymentIntentId = payload?.data?.object?.id;

    if (eventType === 'payment_intent.succeeded' && paymentIntentId) {
      return this.confirmPayment(paymentIntentId);
    }

    return { received: true };
  }
}
