import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';

// Cover for DEFECT-003 / PAY-SEC-002 — authenticated payment bypass.
//
// POST /payments/confirm-payment marked an order PAID from the local Payment
// row alone. It never asked Stripe whether the charge happened, so any
// authenticated seeker could take the PaymentIntent id out of their own
// clientSecret (the prefix before `_secret_`), post it, and receive free goods
// plus download URLs and a receipt email. Proven live on QA.
//
// These tests assert the money-critical invariant: nothing is applied unless
// Stripe says the intent succeeded AND the captured amount covers what the
// linked entity says is owed.

describe('PaymentsService.confirmPayment — Stripe verification', () => {
  let service: PaymentsService;
  let retrievePaymentIntent: jest.Mock;
  let paymentUpdate: jest.Mock;
  let orderUpdate: jest.Mock;
  let prisma: any;

  const PENDING_PAYMENT = {
    id: 'pay_1',
    stripePaymentIntentId: 'pi_test_1',
    status: 'PENDING',
    amount: 120,
    orderId: 'ord_1',
    bookingId: null,
    ticketPurchaseId: null,
    tourBookingId: null,
    paymentType: 'FULL',
  };

  beforeEach(async () => {
    retrievePaymentIntent = jest.fn();
    paymentUpdate = jest.fn().mockResolvedValue({ ...PENDING_PAYMENT, status: 'SUCCEEDED' });
    orderUpdate = jest.fn().mockResolvedValue({});

    prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(PENDING_PAYMENT), update: paymentUpdate },
      order: {
        findUnique: jest.fn().mockResolvedValue({ totalAmount: 120 }),
        update: orderUpdate,
      },
      booking: { findUnique: jest.fn(), update: jest.fn() },
      ticketPurchase: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      tourBooking: { findUnique: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: { retrievePaymentIntent } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    })
      // PaymentsService pulls in a wide constructor; only Prisma + Stripe matter here.
      .useMocker(() => ({}))
      .compile();

    service = moduleRef.get(PaymentsService);
    // Side-effect fan-out is not under test and reaches unmocked collaborators.
    jest.spyOn(service as any, 'handleOrderPaid').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'updateGuideBalance').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'writeLedgerForCharge').mockResolvedValue(undefined);
  });

  // ── The bypass itself ───────────────────────────────────────────────────────

  it('refuses to confirm an intent that never succeeded, and applies nothing', async () => {
    // This is the exact attack: a real PaymentIntent id, no payment made.
    retrievePaymentIntent.mockResolvedValue({ status: 'requires_payment_method', amount_received: 0 });

    await expect(service.confirmPayment('pi_test_1')).rejects.toThrow(BadRequestException);

    // The invariant that matters — no status flip, no fulfillment.
    expect(paymentUpdate).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
    expect((service as any).handleOrderPaid).not.toHaveBeenCalled();
  });

  it.each([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'canceled',
  ])('refuses status "%s"', async (status) => {
    retrievePaymentIntent.mockResolvedValue({ status, amount_received: 0 });
    await expect(service.confirmPayment('pi_test_1')).rejects.toThrow(BadRequestException);
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('always asks Stripe — never trusts the local row alone', async () => {
    retrievePaymentIntent.mockResolvedValue({ status: 'succeeded', amount_received: 12000 });
    await service.confirmPayment('pi_test_1');
    expect(retrievePaymentIntent).toHaveBeenCalledWith('pi_test_1');
  });

  it('refuses when Stripe does not recognise the intent', async () => {
    // Previously `pi_invalid_123` returned 201 as a silent no-op.
    prisma.payment.findUnique.mockResolvedValue(PENDING_PAYMENT);
    retrievePaymentIntent.mockRejectedValue(new Error('No such payment_intent'));
    await expect(service.confirmPayment('pi_invalid_123')).rejects.toThrow(BadRequestException);
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  // ── Amount cross-check (the underpayment variant) ───────────────────────────

  it('refuses an underpaid intent even though Stripe says succeeded', async () => {
    // Attacker pays $1 on a $120 order. Status is genuinely "succeeded", so the
    // status check alone would let this through.
    retrievePaymentIntent.mockResolvedValue({ status: 'succeeded', amount_received: 100 });

    await expect(service.confirmPayment('pi_test_1')).rejects.toThrow(BadRequestException);
    expect(orderUpdate).not.toHaveBeenCalled();
    expect((service as any).handleOrderPaid).not.toHaveBeenCalled();
  });

  it('compares against the order total, not payment.amount', async () => {
    // payment.amount agrees with the charge, but both are client-derived. The
    // order says 500 is owed, so 120 must not be enough.
    prisma.order.findUnique.mockResolvedValue({ totalAmount: 500 });
    retrievePaymentIntent.mockResolvedValue({ status: 'succeeded', amount_received: 12000 });

    await expect(service.confirmPayment('pi_test_1')).rejects.toThrow(BadRequestException);
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('accepts an exact payment and marks the order PAID', async () => {
    retrievePaymentIntent.mockResolvedValue({ status: 'succeeded', amount_received: 12000 });

    await service.confirmPayment('pi_test_1');

    expect(paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED' }) }),
    );
    expect(orderUpdate).toHaveBeenCalledWith({ where: { id: 'ord_1' }, data: { status: 'PAID' } });
  });

  it('tolerates overpayment — only underpayment is a threat', async () => {
    retrievePaymentIntent.mockResolvedValue({ status: 'succeeded', amount_received: 12500 });
    await service.confirmPayment('pi_test_1');
    expect(orderUpdate).toHaveBeenCalled();
  });

  it('survives float-derived totals that do not land on exact cents', async () => {
    // 79.99 + 6.60 = 86.58999999999999; both sides round to 8659.
    prisma.order.findUnique.mockResolvedValue({ totalAmount: 79.99 + 6.6 });
    retrievePaymentIntent.mockResolvedValue({ status: 'succeeded', amount_received: 8659 });
    await service.confirmPayment('pi_test_1');
    expect(orderUpdate).toHaveBeenCalled();
  });

  // ── Idempotency and unknown intents ────────────────────────────────────────

  it('stays idempotent on an already-succeeded payment without calling Stripe', async () => {
    prisma.payment.findUnique.mockResolvedValue({ ...PENDING_PAYMENT, status: 'SUCCEEDED' });
    const result = await service.confirmPayment('pi_test_1');
    expect(result).toMatchObject({ status: 'SUCCEEDED' });
    expect(retrievePaymentIntent).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('returns undefined (not a throw) when no local Payment row exists', async () => {
    // Stripe Checkout sessions may have no Payment row; the webhook must not
    // throw there or Stripe redelivers forever.
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(service.confirmPayment('pi_unknown')).resolves.toBeUndefined();
  });

  it('but the client endpoint turns that into a 404 instead of a silent 201', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(service.confirmPaymentFromClient('pi_invalid_123')).rejects.toThrow(
      NotFoundException,
    );
  });
});
