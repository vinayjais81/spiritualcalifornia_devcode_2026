import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutService } from '../checkout/checkout.service';
import { PUBLIC_GUIDE_WHERE } from '../../common/public-visibility';

/**
 * How long a PENDING order may hold the stock it reserved before the reaper
 * gives it back. Long enough to type a card and clear 3DS, short enough that an
 * abandoned checkout doesn't keep a scarce product off sale.
 */
const DEFAULT_ORDER_HOLD_MINUTES = 30;

/**
 * Outcome of trying to release a PENDING order's hold. Only `released` means
 * stock went back; everything else means the hold was deliberately left alone.
 */
export type OrderReleaseResult =
  | 'released'
  | 'not-pending'      // already PAID/CANCELLED — nothing to do
  | 'payment-in-flight' // customer is mid-payment; try again later
  | 'payment-succeeded'; // they actually paid — confirmPayment will finish it

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly holdMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly checkoutService: CheckoutService,
    private readonly config: ConfigService,
  ) {
    const configured = Number(
      this.config.get<string | number>('ORDER_HOLD_MINUTES', DEFAULT_ORDER_HOLD_MINUTES),
    );
    this.holdMinutes =
      Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_ORDER_HOLD_MINUTES;
  }

  // ─── Create Order ──────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateOrderDto) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    // Resolve products (fresh read outside the transaction for validation + price calc)
    const itemDetails = await Promise.all(
      dto.items.map(async (item) => {
        // Gate on product active + guide visibility so a buyer can't order
        // from an unverified/unpublished/deactivated guide via a direct productId.
        const product = await this.prisma.product.findFirst({
          where: { id: item.productId, isActive: true, guide: PUBLIC_GUIDE_WHERE },
        });
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

        let unitPrice = Number(product.price);

        if (item.variantId) {
          const variant = await this.prisma.productVariant.findUnique({ where: { id: item.variantId } });
          if (!variant || variant.productId !== product.id) throw new BadRequestException('Invalid variant');
          if (variant.price) unitPrice = Number(variant.price);
        }

        return { product, unitPrice, quantity: item.quantity, variantId: item.variantId };
      }),
    );

    const subtotal = itemDetails.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const hasPhysical = itemDetails.some((i) => i.product.type === 'PHYSICAL');

    // Shipping (resolved outside tx since shipping method is immutable reference data)
    let shippingCost = 0;
    if (hasPhysical && dto.shippingMethodId) {
      const method = await this.checkoutService.getShippingMethod(dto.shippingMethodId);
      shippingCost = Number(method.price);
    }

    // Promo code
    let discountAmount = 0;
    let promoCodeId: string | undefined;
    if (dto.promoCode) {
      const promo = await this.checkoutService.validatePromoCode(dto.promoCode, subtotal);
      discountAmount = promo.discountAmount;
      promoCodeId = promo.promoCodeId;
    }

    // Tax — calculated server-side from the shipping state; never trust a client-sent rate.
    const state = dto.shippingAddress?.state;
    let taxRate = 0;
    let taxAmount = 0;
    if (hasPhysical && state) {
      const tax = await this.checkoutService.calculateTax(state, subtotal - discountAmount);
      taxRate = tax.rate;
      taxAmount = tax.taxAmount;
    }

    const totalAmount = subtotal - discountAmount + shippingCost + taxAmount;

    // ─── Supersede this seeker's earlier abandoned attempt ───────────────────
    // Every "Continue to Payment" click lands here, and each one reserves stock
    // and burns a promo redemption. Editing details and clicking again, or
    // simply re-opening checkout later, used to stack up a fresh PENDING order
    // each time — all of them holding inventory nobody was paying for.
    //
    // A seeker can only be paying for one shop order at a time, so a new
    // checkout supersedes the previous attempt. Anything Stripe says is
    // mid-payment is left strictly alone (see releaseOrderHold).
    await this.supersedePendingOrders(seeker.id);

    const holdExpiresAt = new Date(Date.now() + this.holdMinutes * 60 * 1000);

    // ─── Atomic stock check + decrement + order create ──────────────────────
    // Everything in one transaction so concurrent checkouts can't oversell.
    const order = await this.prisma.$transaction(async (tx) => {
      // Re-verify + decrement stock for every physical/variant line.
      // Using conditional updateMany so the row only updates when stock is sufficient.
      for (const line of itemDetails) {
        if (line.variantId) {
          const res = await tx.productVariant.updateMany({
            where: { id: line.variantId, stockQuantity: { gte: line.quantity } },
            data: { stockQuantity: { decrement: line.quantity } },
          });
          if (res.count === 0) {
            throw new BadRequestException(`Insufficient stock for ${line.product.name}`);
          }
        } else if (line.product.type === 'PHYSICAL' && line.product.stockQuantity !== null) {
          const res = await tx.product.updateMany({
            where: { id: line.product.id, stockQuantity: { gte: line.quantity } },
            data: { stockQuantity: { decrement: line.quantity } },
          });
          if (res.count === 0) {
            throw new BadRequestException(`Insufficient stock for ${line.product.name}`);
          }
        }
      }

      const newOrder = await tx.order.create({
        data: {
          seekerId: seeker.id,
          subtotal,
          discountAmount,
          shippingCost,
          taxAmount,
          taxRate,
          totalAmount,
          contactEmail: dto.contactEmail,
          contactFirstName: dto.contactFirstName,
          contactLastName: dto.contactLastName,
          contactPhone: dto.contactPhone,
          shippingAddress: dto.shippingAddress ? (dto.shippingAddress as any) : undefined,
          shippingMethodId: dto.shippingMethodId,
          promoCodeId,
          notes: dto.notes,
          status: 'PENDING',
          // The stock decremented above is now reserved, not sold. This is the
          // deadline for turning it into a sale.
          holdExpiresAt,
          items: {
            create: itemDetails.map((i) => ({
              productId: i.product.id,
              variantId: i.variantId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
        },
        include: { items: { include: { product: { select: { name: true, type: true, imageUrls: true } } } } },
      });

      if (promoCodeId) {
        await tx.promoCode.update({ where: { id: promoCodeId }, data: { usedCount: { increment: 1 } } });
      }

      return newOrder;
    });

    // Create payment intent
    const paymentIntent = await this.paymentsService.createPaymentIntent({
      amount: totalAmount,
      orderId: order.id,
    });

    return { order, paymentIntent };
  }

  // ─── Release a PENDING order's stock hold ─────────────────────────────────

  /**
   * Give back everything a PENDING order reserved and mark it CANCELLED.
   *
   * The single release path behind all three callers — customer cancels, a new
   * checkout supersedes it, or its hold expires — so the "what does an
   * abandoned order give back" rule lives in exactly one place:
   *
   *   - product / variant stock, per line
   *   - the promo redemption counted at create (never below zero)
   *   - the Stripe PaymentIntent, cancelled so the client secret still sitting
   *     in the customer's browser can't be charged against released stock
   *
   * Order of operations matters. The PaymentIntent is checked and cancelled
   * *before* any stock moves, and a non-`released` verdict aborts without
   * touching a thing — releasing inventory out from under a live charge is the
   * one failure worse than the bug this fixes.
   */
  async releaseOrderHold(
    orderId: string,
    reason: string,
    opts: { allowRequiresAction?: boolean } = {},
  ): Promise<OrderReleaseResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        promoCodeId: true,
        payment: { select: { stripePaymentIntentId: true } },
        items: {
          select: {
            productId: true,
            variantId: true,
            quantity: true,
            product: { select: { type: true, stockQuantity: true } },
          },
        },
      },
    });

    if (!order || order.status !== 'PENDING') return 'not-pending';

    if (order.payment?.stripePaymentIntentId) {
      const verdict = await this.paymentsService.releaseUnpaidPaymentIntent(
        order.payment.stripePaymentIntentId,
        { allowRequiresAction: opts.allowRequiresAction },
      );
      if (verdict === 'paid') return 'payment-succeeded';
      if (verdict !== 'released') return 'payment-in-flight';
    }

    return this.prisma.$transaction(async (tx) => {
      // Claim the row first. If this updates nothing, another release (or a
      // payment) got here first and already accounted for the stock — bailing
      // out is what keeps a double-run from crediting inventory twice.
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
          holdExpiresAt: null,
        },
      });
      if (claimed.count === 0) return 'not-pending';

      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        } else if (item.product.type === 'PHYSICAL' && item.product.stockQuantity !== null) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
      }

      if (order.promoCodeId) {
        // Guarded so a stray release can never push the tally negative and
        // hand out redemptions the promo's usage limit should have stopped.
        await tx.promoCode.updateMany({
          where: { id: order.promoCodeId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      return 'released' as const;
    });
  }

  /**
   * Release any live PENDING order this seeker left behind before starting a
   * new one. Best-effort: a hold we can't safely release (mid-payment, or
   * Stripe unreachable) is left for the reaper rather than blocking checkout.
   */
  private async supersedePendingOrders(seekerId: string) {
    const stale = await this.prisma.order.findMany({
      where: { seekerId, status: 'PENDING' },
      select: { id: true },
    });

    for (const o of stale) {
      try {
        const result = await this.releaseOrderHold(
          o.id,
          'Superseded by a new checkout attempt',
        );
        if (result === 'payment-in-flight' || result === 'payment-succeeded') {
          this.logger.warn(
            `Left order ${o.id} in place while starting a new checkout — payment is ${result}.`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed to supersede pending order ${o.id}: ${err?.message}`);
      }
    }
  }

  /**
   * Customer-initiated cancel of their own unpaid order — the missing exit that
   * turned an abandoned checkout into a record they couldn't do anything about.
   */
  async cancelMyOrder(userId: string, orderId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, seekerId: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.seekerId !== seeker.id) throw new ForbiddenException('Access denied');
    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Only unpaid orders can be cancelled — this one is ${order.status.toLowerCase()}. Contact support for a refund or return.`,
      );
    }

    const result = await this.releaseOrderHold(orderId, 'Cancelled by customer');

    if (result === 'payment-succeeded') {
      throw new BadRequestException(
        'This order has just been paid, so it can no longer be cancelled here. Contact support if you need a refund.',
      );
    }
    if (result === 'payment-in-flight') {
      throw new BadRequestException(
        'A payment on this order is still being processed. Please wait a moment and try again.',
      );
    }

    return this.findOne(userId, orderId);
  }

  /**
   * Reaper entry point: cancel every PENDING order whose hold has run out and
   * hand its stock back. Runs every few minutes from the order-tasks queue.
   */
  async releaseExpiredHolds(): Promise<{ released: number; skipped: number }> {
    const now = new Date();
    const expired = await this.prisma.order.findMany({
      where: { status: 'PENDING', holdExpiresAt: { lt: now } },
      select: { id: true, holdExpiresAt: true },
    });

    // A customer who opens the 3DS sheet and walks away parks the intent in
    // `requires_action` indefinitely, so a strict reading of "never touch a
    // live payment" would hold that stock forever. Once the hold is a full
    // window overdue, treat the 3DS attempt as abandoned too.
    const staleCutoff = new Date(now.getTime() - this.holdMinutes * 60 * 1000);

    let released = 0;
    let skipped = 0;
    for (const order of expired) {
      try {
        const result = await this.releaseOrderHold(order.id, 'Payment not completed — stock hold expired', {
          allowRequiresAction: !!order.holdExpiresAt && order.holdExpiresAt < staleCutoff,
        });
        if (result === 'released') released++;
        else skipped++;
      } catch (err: any) {
        skipped++;
        this.logger.error(`Failed to release hold for order ${order.id}: ${err?.message}`);
      }
    }

    if (released > 0 || skipped > 0) {
      this.logger.log(`Order hold reaper: released ${released}, left ${skipped} in place`);
    }
    return { released, skipped };
  }

  // ─── List Seeker's Orders ──────────────────────────────────────────────────

  async findMyOrders(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) return [];
    return this.prisma.order.findMany({
      where: { seekerId: seeker.id },
      include: {
        items: { include: { product: { select: { name: true, type: true, imageUrls: true } } } },
        payment: { select: { status: true, paymentMethod: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Get Single Order ──────────────────────────────────────────────────────

  async findOne(userId: string, orderId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        payment: true,
        promoCode: { select: { code: true, type: true, amount: true } },
        shippingMethod: { select: { name: true, estimatedDaysMin: true, estimatedDaysMax: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (seeker && order.seekerId !== seeker.id) throw new ForbiddenException('Access denied');
    return order;
  }
}
