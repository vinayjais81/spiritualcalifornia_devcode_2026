import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutService } from '../checkout/checkout.service';
import { PrismaService } from '../../database/prisma.service';

// Cover for QA issue #1 — abandoning checkout at the payment step left a
// permanent orphaned order.
//
// `POST /orders` reserves stock and burns a promo redemption when the customer
// clicks "Continue to Payment", so an abandoned checkout didn't just leave a
// junk row: it held real inventory off sale forever. These tests pin the
// release path, and — more importantly — pin the cases where release must NOT
// happen. Handing stock back while a charge is still live would oversell and
// force a refund on a real customer, which is worse than the original bug.

describe('OrdersService — releasing an abandoned order hold', () => {
  let service: OrdersService;
  let prisma: any;
  let releaseUnpaidPaymentIntent: jest.Mock;
  let tx: any;

  const PENDING_ORDER = {
    id: 'ord_1',
    status: 'PENDING',
    promoCodeId: 'promo_1',
    payment: { stripePaymentIntentId: 'pi_1' },
    items: [
      // physical, tracked stock → must be returned
      { productId: 'prod_1', variantId: null, quantity: 2, product: { type: 'PHYSICAL', stockQuantity: 5 } },
      // variant line → returned on the variant, not the product
      { productId: 'prod_2', variantId: 'var_1', quantity: 1, product: { type: 'PHYSICAL', stockQuantity: 3 } },
      // digital → nothing to return
      { productId: 'prod_3', variantId: null, quantity: 1, product: { type: 'DIGITAL', stockQuantity: null } },
    ],
  };

  beforeEach(async () => {
    releaseUnpaidPaymentIntent = jest.fn().mockResolvedValue('released');

    tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      product: { update: jest.fn().mockResolvedValue({}) },
      productVariant: { update: jest.fn().mockResolvedValue({}) },
      promoCode: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    prisma = {
      seekerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'seek_1', userId: 'user_1' }) },
      order: {
        findUnique: jest.fn().mockResolvedValue(PENDING_ORDER),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: { releaseUnpaidPaymentIntent, createPaymentIntent: jest.fn() } },
        { provide: CheckoutService, useValue: {} },
        { provide: ConfigService, useValue: { get: (_k: string, d: any) => d } },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  // ── The release itself ────────────────────────────────────────────────────

  it('returns stock, the promo redemption, and the PaymentIntent', async () => {
    const result = await service.releaseOrderHold('ord_1', 'Cancelled by customer');

    expect(result).toBe('released');
    expect(releaseUnpaidPaymentIntent).toHaveBeenCalledWith('pi_1', { allowRequiresAction: undefined });

    // Order is cancelled with its audit trail, and no longer holds a deadline.
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord_1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancellationReason: 'Cancelled by customer',
          holdExpiresAt: null,
        }),
      }),
    );

    // Physical line back to the product, variant line back to the variant.
    expect(tx.product.update).toHaveBeenCalledTimes(1);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { stockQuantity: { increment: 2 } },
    });
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'var_1' },
      data: { stockQuantity: { increment: 1 } },
    });

    // Promo redemption given back, guarded so it can't go negative.
    expect(tx.promoCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'promo_1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });

  // ── Where release must refuse ─────────────────────────────────────────────

  it('leaves everything alone when the customer actually paid', async () => {
    releaseUnpaidPaymentIntent.mockResolvedValue('paid');

    await expect(service.releaseOrderHold('ord_1', 'hold expired')).resolves.toBe('payment-succeeded');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it.each(['in_flight', 'unknown'])(
    'leaves the hold in place when Stripe says "%s"',
    async (verdict) => {
      releaseUnpaidPaymentIntent.mockResolvedValue(verdict);

      await expect(service.releaseOrderHold('ord_1', 'hold expired')).resolves.toBe('payment-in-flight');

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.product.update).not.toHaveBeenCalled();
    },
  );

  it('does not credit stock twice when a concurrent release already claimed the order', async () => {
    // Two reapers (or a reaper and a customer click) racing on one order: the
    // loser's claim updates zero rows and must not touch inventory.
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.releaseOrderHold('ord_1', 'hold expired')).resolves.toBe('not-pending');

    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.promoCode.updateMany).not.toHaveBeenCalled();
  });

  it('is a no-op for an order that is no longer PENDING', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...PENDING_ORDER, status: 'PAID' });

    await expect(service.releaseOrderHold('ord_1', 'hold expired')).resolves.toBe('not-pending');

    expect(releaseUnpaidPaymentIntent).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Customer-facing cancel ────────────────────────────────────────────────

  describe('cancelMyOrder', () => {
    it("refuses to cancel another seeker's order", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'ord_1', seekerId: 'someone_else', status: 'PENDING' });

      await expect(service.cancelMyOrder('user_1', 'ord_1')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to cancel an order that is already paid', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'ord_1', seekerId: 'seek_1', status: 'PAID' });

      await expect(service.cancelMyOrder('user_1', 'ord_1')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('tells the customer to wait rather than silently failing when payment is in flight', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({ id: 'ord_1', seekerId: 'seek_1', status: 'PENDING' })
        .mockResolvedValue(PENDING_ORDER);
      releaseUnpaidPaymentIntent.mockResolvedValue('in_flight');

      await expect(service.cancelMyOrder('user_1', 'ord_1')).rejects.toThrow(
        /still being processed/,
      );
    });
  });

  // ── The reaper ────────────────────────────────────────────────────────────

  describe('releaseExpiredHolds', () => {
    it('only authorises killing a live 3DS attempt once the hold is a full window overdue', async () => {
      const now = Date.now();
      prisma.order.findMany.mockResolvedValue([
        // 1 minute past its deadline — customer may still be in the 3DS sheet.
        { id: 'ord_fresh', holdExpiresAt: new Date(now - 1 * 60 * 1000) },
        // Well past it (default window is 30 min) — treat 3DS as abandoned.
        { id: 'ord_stale', holdExpiresAt: new Date(now - 90 * 60 * 1000) },
      ]);
      const release = jest
        .spyOn(service, 'releaseOrderHold')
        .mockResolvedValue('released');

      await expect(service.releaseExpiredHolds()).resolves.toEqual({ released: 2, skipped: 0 });

      expect(release).toHaveBeenCalledWith('ord_fresh', expect.any(String), { allowRequiresAction: false });
      expect(release).toHaveBeenCalledWith('ord_stale', expect.any(String), { allowRequiresAction: true });
    });

    it('counts a hold it could not release as skipped and keeps going', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'ord_a', holdExpiresAt: new Date(Date.now() - 60_000) },
        { id: 'ord_b', holdExpiresAt: new Date(Date.now() - 60_000) },
      ]);
      jest
        .spyOn(service, 'releaseOrderHold')
        .mockRejectedValueOnce(new Error('stripe down'))
        .mockResolvedValueOnce('released');

      await expect(service.releaseExpiredHolds()).resolves.toEqual({ released: 1, skipped: 1 });
    });
  });
});
