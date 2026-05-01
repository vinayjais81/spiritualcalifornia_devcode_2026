import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EarningCategory } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from './stripe.service';
import { LedgerService } from './ledger.service';
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
    private readonly ledgerService: LedgerService,
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

    // v1: direct balance mutation. Owns the cached PayoutAccount columns
    // until LEDGER_V2_ENABLED flips at cutover (P9).
    await this.updateGuideBalance(payment);

    // v2 shadow-write: ledger fan-out per guide-attributable line.
    // Errors are swallowed and logged so a ledger-write bug never blocks a
    // webhook ack (which would cause Stripe to retry endlessly).
    this.writeLedgerForCharge(payment).catch((err) =>
      this.logger.error(
        `Ledger fan-out failed for payment ${payment.id}: ${err?.message}`,
        err?.stack,
      ),
    );

    this.logger.log(`Payment confirmed: ${payment.id}`);
    return updated;
  }

  // ─── Payments publish gate ─────────────────────────────────────────────────

  /**
   * Returns whether a guide is permitted to publish a paid offering
   * (service / event / tour / product) right now. The gate is two-prong:
   *   - Stripe Connect onboarding completed (`stripeOnboardingDone`)
   *   - Stripe currently has payouts enabled (`payoutAccount.payoutsEnabled`)
   *
   * Free offerings (price == 0) bypass the gate entirely; the caller checks
   * the price first and only invokes this helper when paid.
   *
   * Spec: docs/payments-publish-gate.md §5.
   */
  async canPublishPaidOffering(guideId: string): Promise<{
    allowed: boolean;
    reason?: 'no-stripe-account' | 'onboarding-incomplete' | 'payouts-disabled';
    stripeOnboardingDone: boolean;
    payoutsEnabled: boolean;
    ctaUrl: string;
  }> {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: guideId },
      select: { stripeAccountId: true, stripeOnboardingDone: true },
    });
    const account = await this.prisma.payoutAccount.findUnique({
      where: { guideId },
      select: { payoutsEnabled: true },
    });

    const ctaUrl = `${this.config.get('FRONTEND_URL') ?? ''}/guide/dashboard/earnings`;
    const stripeOnboardingDone = !!guide?.stripeOnboardingDone;
    const payoutsEnabled = !!account?.payoutsEnabled;

    // 'pending-setup' is a sentinel from a half-finished v1 onboarding.
    const hasRealAccount =
      !!guide?.stripeAccountId && guide.stripeAccountId !== 'pending-setup';

    if (!hasRealAccount) {
      return { allowed: false, reason: 'no-stripe-account', stripeOnboardingDone, payoutsEnabled, ctaUrl };
    }
    if (!stripeOnboardingDone) {
      return { allowed: false, reason: 'onboarding-incomplete', stripeOnboardingDone, payoutsEnabled, ctaUrl };
    }
    if (!payoutsEnabled) {
      return { allowed: false, reason: 'payouts-disabled', stripeOnboardingDone, payoutsEnabled, ctaUrl };
    }
    return { allowed: true, stripeOnboardingDone: true, payoutsEnabled: true, ctaUrl };
  }

  /**
   * Throws a structured 403 the frontend axios interceptor can catch
   * (`error: 'PAYMENT_GATE_BLOCKED'`) and render as a modal instead of a
   * generic toast. Centralized so every publish endpoint shapes the same
   * payload.
   */
  assertCanPublishPaidOffering(gate: {
    allowed: boolean;
    reason?: string;
    ctaUrl: string;
  }): void {
    if (gate.allowed) return;
    throw new ForbiddenException({
      error: 'PAYMENT_GATE_BLOCKED',
      message: 'Set up payment receipt before publishing a paid offering.',
      reason: gate.reason,
      ctaUrl: gate.ctaUrl,
      ctaLabel: 'Set Up Payments',
    });
  }

  // ─── Physical product delivery hook ───────────────────────────────────────

  /**
   * Marks the items on an order as delivered and writes the ledger fan-out
   * that was deferred at charge time for any physical items.
   *
   * Background: physical OrderItems can't have a clearance window until
   * they ship — refund risk is open until delivery. So writeLedgerForCharge
   * skips them and leaves a TODO. This method closes the loop, called by
   * an admin "Mark delivered" action (or, in the future, a carrier webhook).
   *
   * Per-item logic: idempotent on (paymentId, guideId, orderItemId), so
   * re-running for an already-delivered item is a no-op.
   */
  async markOrderDelivered(orderId: string): Promise<{ written: number; skipped: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        items: {
          include: {
            product: { select: { guideId: true, type: true, name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.payment || order.payment.status !== 'SUCCEEDED') {
      throw new BadRequestException(
        'Cannot mark delivered until the order is paid',
      );
    }

    const now = new Date();

    // Stamp deliveredAt for any item that doesn't have it yet.
    const undelivered = order.items.filter((i) => !i.deliveredAt);
    if (undelivered.length > 0) {
      await this.prisma.orderItem.updateMany({
        where: { id: { in: undelivered.map((i) => i.id) } },
        data: { deliveredAt: now },
      });
    }

    // Flip Order.status if not already DELIVERED. Don't downgrade past states
    // (e.g. REFUNDED stays REFUNDED).
    if (order.status === 'PAID' || order.status === 'SHIPPED') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'DELIVERED' },
      });
    }

    // Write the deferred ledger fan-out for each physical item.
    let written = 0;
    let skipped = 0;
    for (const item of order.items) {
      // Digital items had their fan-out written at charge time. Skip them
      // here so we don't double-write (the LedgerService is idempotent
      // anyway, but skipping is cheaper and keeps the count accurate).
      if (item.product.type === 'DIGITAL') {
        skipped++;
        continue;
      }
      const result = await this.ledgerService.writeChargeEntries({
        guideId: item.product.guideId,
        paymentId: order.payment.id,
        orderItemId: item.id,
        grossAmount: Number(item.unitPrice) * item.quantity,
        category: 'PRODUCT' as EarningCategory,
        clearanceAnchor: item.deliveredAt ?? now,
        description: `Order ${order.id} — ${item.product.name} ×${item.quantity} (delivered)`,
      });
      // writeChargeEntries returns the existing fan-out without writing if
      // entries already exist; we count it as "skipped" only if no money
      // moved (i.e. we discovered an existing $X net rather than computing one).
      if (result.entries.length > 0) written++;
      else skipped++;
    }

    this.logger.log(
      `markOrderDelivered: order=${order.id} stamped=${undelivered.length} ledgerWritten=${written} skipped=${skipped}`,
    );
    return { written, skipped };
  }

  // ─── v2 Ledger Fan-out Dispatcher ──────────────────────────────────────────

  /**
   * Resolves the (category, guide, gross, clearance anchor) tuple(s) for a
   * succeeded payment and delegates to LedgerService.writeChargeEntries.
   *
   * - Service / Tour / Event: 1 fan-out (1 guide).
   * - Order: N fan-outs, one per OrderItem, grouped by product.guideId. This
   *   is what closes the v1 "products skipped — multi-seller" gap.
   *
   * For physical products, clearanceAt stays null until OrderItem.deliveredAt
   * is set (carrier webhook or admin "mark delivered"). The clearance cron
   * skips entries with null clearanceAt — see P3.
   */
  private async writeLedgerForCharge(payment: any): Promise<void> {
    if (payment.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: {
          service: { select: { guideId: true } },
          slot: { select: { endTime: true } },
        },
      });
      if (!booking) return;
      await this.ledgerService.writeChargeEntries({
        guideId: booking.service.guideId,
        paymentId: payment.id,
        grossAmount: Number(payment.amount),
        category: 'SERVICE' as EarningCategory,
        clearanceAnchor: booking.slot.endTime,
        description: `Service booking ${booking.id}`,
      });
      return;
    }

    if (payment.tourBookingId) {
      const tb = await this.prisma.tourBooking.findUnique({
        where: { id: payment.tourBookingId },
        include: {
          tour: { select: { guideId: true } },
          departure: { select: { endDate: true } },
        },
      });
      if (!tb) return;
      // For deposits, anchor still uses departure end so a refund stays
      // possible across the deposit→balance window.
      await this.ledgerService.writeChargeEntries({
        guideId: tb.tour.guideId,
        paymentId: payment.id,
        grossAmount: Number(payment.amount),
        category: 'TOUR' as EarningCategory,
        clearanceAnchor: tb.departure?.endDate ?? new Date(),
        description: `Tour booking ${tb.id} (${payment.paymentType})`,
      });
      return;
    }

    if (payment.ticketPurchaseId) {
      const tp = await this.prisma.ticketPurchase.findUnique({
        where: { id: payment.ticketPurchaseId },
        include: {
          tier: {
            include: {
              event: { select: { guideId: true, endTime: true } },
            },
          },
        },
      });
      if (!tp) return;
      await this.ledgerService.writeChargeEntries({
        guideId: tp.tier.event.guideId,
        paymentId: payment.id,
        grossAmount: Number(payment.amount),
        category: 'EVENT' as EarningCategory,
        clearanceAnchor: tp.tier.event.endTime,
        description: `Event ticket ${tp.id}`,
      });
      return;
    }

    if (payment.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: payment.orderId },
        include: {
          items: {
            include: {
              product: { select: { guideId: true, type: true, name: true } },
            },
          },
        },
      });
      if (!order) return;

      // Mark Order.paidAt + flip digital items' deliveredAt (delivery == payment
      // for digital). Physical items stay null until shipped.
      const now = new Date();
      if (!order.paidAt) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paidAt: now },
        });
      }
      const digitalItemIds = order.items
        .filter((i) => i.product.type === 'DIGITAL' && !i.deliveredAt)
        .map((i) => i.id);
      if (digitalItemIds.length > 0) {
        await this.prisma.orderItem.updateMany({
          where: { id: { in: digitalItemIds } },
          data: { deliveredAt: now },
        });
      }

      // One fan-out per item, attributed to its product's guide.
      // Per-item granularity lets refunds reverse a single item without
      // touching the rest of the order.
      for (const item of order.items) {
        const itemGross = Number(item.unitPrice) * item.quantity;
        const isDigital = item.product.type === 'DIGITAL';
        // Physical items: anchor will be set when deliveredAt populates.
        // Pass the delivery date (now for digital, far-future placeholder
        // for physical) so the cron can pick it up correctly later.
        const anchor = isDigital ? now : item.deliveredAt;
        if (!anchor) {
          // Physical item not yet delivered. Skip ledger write here; the
          // delivery webhook / admin mark-delivered handler will trigger
          // the fan-out at that time. (Keeps clearance window honest.)
          this.logger.log(
            `Order ${order.id} item ${item.id} (physical, not delivered) — ledger fan-out deferred until delivery`,
          );
          continue;
        }
        await this.ledgerService.writeChargeEntries({
          guideId: item.product.guideId,
          paymentId: payment.id,
          orderItemId: item.id,
          grossAmount: itemGross,
          category: 'PRODUCT' as EarningCategory,
          clearanceAnchor: anchor,
          description: `Order ${order.id} — ${item.product.name} ×${item.quantity}`,
        });
      }
      return;
    }
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
    if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIALLY_REFUNDED')
      throw new BadRequestException('Can only refund succeeded or partially-refunded payments');

    const refundAmount = amount ?? Number(payment.amount);
    const totalRefundedSoFar = Number(payment.refundedAmount ?? 0);
    if (totalRefundedSoFar + refundAmount > Number(payment.amount) + 0.01) {
      throw new BadRequestException(
        `Refund of $${refundAmount} would exceed payment amount $${Number(payment.amount)} (already refunded $${totalRefundedSoFar})`,
      );
    }

    // Real Stripe refund
    const refund = await this.stripeService.createRefund(
      payment.stripePaymentIntentId,
      refundAmount,
    );

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status:
          totalRefundedSoFar + refundAmount >= Number(payment.amount)
            ? 'REFUNDED'
            : 'PARTIALLY_REFUNDED',
        refundedAmount: totalRefundedSoFar + refundAmount,
        stripeRefundId: refund.id,
      },
    });

    // v2: write the matching REFUND_REVERSAL ledger entries. Async fire-and-
    // forget so a ledger glitch never blocks the user-visible refund result.
    this.ledgerService
      .writeRefundReversal({
        paymentId: payment.id,
        refundAmount,
        refundedFraction: refundAmount / Number(payment.amount),
        reason: 'REFUND',
        description: `Refund $${refundAmount} of payment ${payment.id}`,
      })
      .catch((err) =>
        this.logger.error(
          `Refund reversal ledger write failed for payment ${payment.id}: ${err?.message}`,
          err?.stack,
        ),
      );

    return updated;
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

    // Generic idempotency: every Stripe event has a unique id. Reject replays
    // before any side effect runs. confirmPayment is also idempotent on
    // payment status, but Connect / refund / dispute events rely on this gate.
    const seen = await this.prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
    });
    if (seen) {
      this.logger.log(`Webhook ${event.id} (${event.type}) already processed — skipping`);
      return { received: true, deduped: true };
    }

    this.logger.log(`Webhook received: ${event.type} (${event.id})`);

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
      case 'charge.dispute.created':
      case 'charge.dispute.funds_withdrawn': {
        // Seeker filed a chargeback. Write reversal entries for the disputed
        // amount AND auto-hold the guide's account so no payout claim slips
        // through while we triage. funds_withdrawn fires when Stripe debits
        // the platform; treat both events the same so we don't double-act.
        const dispute = event.data.object as any;
        const chargeId: string | undefined = dispute.charge;
        const amountCents: number = dispute.amount ?? 0;
        const reason: string = dispute.reason ?? 'unknown';
        if (!chargeId || amountCents === 0) {
          this.logger.warn(`Dispute event ${event.id} missing charge/amount — skip`);
          break;
        }

        // Resolve our Payment from the Stripe charge → PaymentIntent.
        let payment: any = null;
        try {
          const charge: any = await this.stripeService.retrieveCharge(chargeId);
          if (charge?.payment_intent) {
            payment = await this.prisma.payment.findUnique({
              where: { stripePaymentIntentId: charge.payment_intent },
            });
          }
        } catch (err: any) {
          this.logger.error(`Could not resolve charge ${chargeId}: ${err.message}`);
        }
        if (!payment) {
          this.logger.warn(`Dispute on charge ${chargeId}: no matching Payment row — skip`);
          break;
        }

        const disputedDollars = amountCents / 100;
        await this.ledgerService.writeRefundReversal({
          paymentId: payment.id,
          refundAmount: disputedDollars,
          refundedFraction: disputedDollars / Number(payment.amount),
          reason: 'DISPUTE',
          description: `Chargeback (${reason}) on payment ${payment.id}`,
        });

        // Auto-hold every guide tied to this payment so claim attempts halt
        // until ops triages. Multi-guide order = multiple ledger guideIds.
        const affectedGuides = await this.prisma.ledgerEntry.findMany({
          where: { paymentId: payment.id },
          select: { guideId: true },
          distinct: ['guideId'],
        });
        for (const g of affectedGuides) {
          await this.prisma.payoutAccount.updateMany({
            where: { guideId: g.guideId },
            data: {
              holdActive: true,
              holdReason: `Auto-hold: chargeback ${dispute.id} (${reason})`,
              holdSetAt: new Date(),
              holdSetBy: 'system',
            },
          });
        }

        this.logger.warn(
          `Chargeback on payment ${payment.id}: $${disputedDollars} reason=${reason}, ${affectedGuides.length} guide(s) auto-held`,
        );
        break;
      }
      case 'account.updated': {
        // Stripe Connect account state changed. v2 mirrors `payouts_enabled`
        // onto PayoutAccount so the claim endpoint can gate on Stripe truth
        // (Stripe can disable payouts post-onboarding when more info is
        // needed — v1 missed this case).
        const account = event.data.object as any;
        const onboardingDone =
          !!account.charges_enabled && !!account.details_submitted;

        await this.prisma.guideProfile.updateMany({
          where: { stripeAccountId: account.id },
          data: { stripeOnboardingDone: onboardingDone },
        });

        await this.prisma.payoutAccount.updateMany({
          where: { stripeAccountId: account.id },
          data: { payoutsEnabled: !!account.payouts_enabled },
        });

        this.logger.log(
          `Connect ${account.id}: onboarded=${onboardingDone} payouts_enabled=${!!account.payouts_enabled}`,
        );
        break;
      }
      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }

    // Stamp idempotency only after side effects succeed. If anything threw,
    // the row stays absent so Stripe's retry can replay.
    await this.prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });

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
    // Locked decision #4: minimum payout = $50.
    if (amount < 50) throw new BadRequestException('Minimum payout amount is $50');

    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new NotFoundException('Guide profile not found');

    const payoutAccount = await this.prisma.payoutAccount.findUnique({
      where: { guideId: guide.id },
    });
    if (!payoutAccount)
      throw new BadRequestException('No payout account found. Set up Stripe Connect first.');

    // Hard gate: admin hold blocks every claim attempt.
    if (payoutAccount.holdActive) {
      throw new BadRequestException(
        `Payouts are temporarily on hold for your account. Reason: ${payoutAccount.holdReason ?? 'under review'}`,
      );
    }

    // Hard gate: Stripe must say payouts are enabled (post-onboarding it can
    // toggle this off when more info is required — v1 missed this case).
    if (!guide.stripeOnboardingDone || !payoutAccount.payoutsEnabled) {
      throw new BadRequestException(
        'Stripe Connect onboarding incomplete or payouts disabled by Stripe. Open the Stripe dashboard to resolve.',
      );
    }

    if (Number(payoutAccount.availableBalance) < amount)
      throw new BadRequestException('Insufficient available balance');

    if (this.ledgerService.isV2Live()) {
      return this.requestPayoutV2(guide.id, payoutAccount.id, amount);
    }
    return this.requestPayoutV1(guide.id, payoutAccount.id, amount);
  }

  // v1 path — direct balance decrement (preserved until cutover).
  private async requestPayoutV1(guideId: string, payoutAccountId: string, amount: number) {
    const payout = await this.prisma.payoutRequest.create({
      data: {
        guideId,
        payoutAccountId,
        amount,
        status: 'PENDING',
      },
    });

    await this.prisma.payoutAccount.update({
      where: { id: payoutAccountId },
      data: { availableBalance: { decrement: amount } },
    });

    this.logger.log(`Payout requested (v1): ${payout.id} for $${amount} by guide ${guideId}`);
    return payout;
  }

  // v2 path — FIFO consumption of AVAILABLE ledger entries.
  // Picks oldest-clearance entries until the requested amount is reserved,
  // links them to the new PayoutRequest. Cached balance recomputes from
  // ledger so the available number drops by exactly `amount`.
  private async requestPayoutV2(guideId: string, payoutAccountId: string, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.create({
        data: {
          guideId,
          payoutAccountId,
          amount,
          status: 'PENDING',
        },
      });

      // Reserve AVAILABLE entries (NET_PAYABLE / REFUND_REVERSAL / ADJUSTMENT
      // / PAYOUT_REVERSAL) FIFO by clearance date. We don't actually
      // partition entries — instead we tag whole entries with payoutRequestId
      // until the running sum >= amount. If the last entry overshoots, we
      // accept the small overshoot rather than splitting (simpler, and the
      // cached balance recompute reflects truth either way).
      const candidates = await tx.ledgerEntry.findMany({
        where: {
          guideId,
          status: 'AVAILABLE',
          payoutRequestId: null,
          entryType: {
            in: ['NET_PAYABLE', 'REFUND_REVERSAL', 'PAYOUT_REVERSAL', 'ADJUSTMENT'],
          },
          amount: { gt: 0 }, // never reserve negative entries (refund reversals)
        },
        orderBy: [{ clearanceAt: 'asc' }, { createdAt: 'asc' }],
      });

      let running = 0;
      const toReserve: string[] = [];
      for (const e of candidates) {
        if (running >= amount) break;
        toReserve.push(e.id);
        running += Number(e.amount);
      }

      if (running < amount - 0.01) {
        // Race: balance check passed but reservation came up short
        // (concurrent refund reversal removed AVAILABLE rows). Roll back
        // the PayoutRequest by failing the transaction.
        throw new BadRequestException(
          'Insufficient available balance — refund or adjustment reduced your balance. Please retry.',
        );
      }

      if (toReserve.length > 0) {
        await tx.ledgerEntry.updateMany({
          where: { id: { in: toReserve } },
          data: { payoutRequestId: payout.id },
        });
      }

      // Refresh cached aggregate from ledger.
      await this.ledgerService.recomputeCachedBalance(guideId);

      this.logger.log(
        `Payout requested (v2): ${payout.id} for $${amount} by guide ${guideId} — reserved ${toReserve.length} ledger entries (sum=$${running})`,
      );
      return payout;
    });
  }

  // ─── Process Payout (Admin triggers actual Stripe transfer) ────────────────

  async processPayout(payoutRequestId: string) {
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutRequestId },
      include: {
        payoutAccount: true,
        guide: {
          select: {
            stripeAccountId: true,
            stripeOnboardingDone: true,
            displayName: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
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

      if (this.ledgerService.isV2Live()) {
        // v2: write the PAYOUT ledger entry and flip every reserved
        // ledger entry's status from AVAILABLE → PAID_OUT.
        await this.prisma.ledgerEntry.updateMany({
          where: { payoutRequestId: payout.id, status: 'AVAILABLE' },
          data: { status: 'PAID_OUT' },
        });
        await this.prisma.ledgerEntry.create({
          data: {
            guideId: payout.guideId,
            entryType: 'PAYOUT',
            amount: -Number(payout.amount),
            currency: payout.currency ?? 'USD',
            status: 'PAID_OUT',
            // PAYOUT aggregates earnings across categories — leave null so
            // category-filtered reports don't mis-attribute.
            category: null,
            payoutRequestId: payout.id,
            description: `Stripe transfer ${transfer.id}`,
            metadata: { stripeTransferId: transfer.id },
          },
        });
        await this.ledgerService.recomputeCachedBalance(payout.guideId);
      } else {
        // v1: bump cached column directly.
        await this.prisma.payoutAccount.update({
          where: { id: payout.payoutAccountId },
          data: { totalPaidOut: { increment: Number(payout.amount) } },
        });
      }

      this.logger.log(`Payout completed: ${payout.id} → Stripe transfer ${transfer.id}`);

      // Notify the guide (fire-and-forget — never fails the payout result).
      if (payout.guide.user?.email && payout.guide.user.id) {
        this.notifications
          .notifyPayoutCompleted({
            userId: payout.guide.user.id,
            email: payout.guide.user.email,
            guideName: payout.guide.displayName,
            amount: `$${Number(payout.amount).toLocaleString()}`,
            transferId: transfer.id,
            earningsUrl: `${this.config.get('FRONTEND_URL')}/guide/dashboard/earnings`,
          })
          .catch((e) => this.logger.error(`Payout-completed notification failed: ${e?.message}`));
      }

      return { status: 'COMPLETED', transferId: transfer.id };
    } catch (err: any) {
      // Stripe transfer failed — release the reservation so the funds become
      // claimable again.
      await this.prisma.payoutRequest.update({
        where: { id: payout.id },
        data: { status: 'FAILED', failureReason: err?.message?.slice(0, 500) },
      });

      if (this.ledgerService.isV2Live()) {
        // v2: clear the reservation; entries return to the AVAILABLE pool.
        await this.prisma.ledgerEntry.updateMany({
          where: { payoutRequestId: payout.id },
          data: { payoutRequestId: null },
        });
        await this.ledgerService.recomputeCachedBalance(payout.guideId);
      } else {
        // v1: re-credit the cached column.
        await this.prisma.payoutAccount.update({
          where: { id: payout.payoutAccountId },
          data: { availableBalance: { increment: Number(payout.amount) } },
        });
      }

      this.logger.error(`Payout failed: ${payout.id} — ${err.message}`);

      if (payout.guide.user?.email && payout.guide.user.id) {
        this.notifications
          .notifyPayoutFailed({
            userId: payout.guide.user.id,
            email: payout.guide.user.email,
            guideName: payout.guide.displayName,
            amount: `$${Number(payout.amount).toLocaleString()}`,
            reason: err?.message ?? 'Unknown',
            earningsUrl: `${this.config.get('FRONTEND_URL')}/guide/dashboard/earnings`,
          })
          .catch((e) => this.logger.error(`Payout-failed notification failed: ${e?.message}`));
      }

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

    // v2: prefer ledger SUM for pending so the UI shows real numbers, not
    // the v1 placeholder of 0. Available/totalEarned/totalPaidOut still
    // come from the cached column (which v2 keeps in sync via
    // recomputeCachedBalance once LEDGER_V2_ENABLED=true).
    let pending = Number(payoutAccount?.pendingBalance ?? 0);
    if (this.ledgerService.isV2Live()) {
      pending = await this.ledgerService.getPendingBalance(guide.id);
    }

    return {
      balance: {
        available: Number(payoutAccount?.availableBalance ?? 0),
        pending,
        totalEarned: Number(payoutAccount?.totalEarned ?? 0),
        totalPaidOut: Number(payoutAccount?.totalPaidOut ?? 0),
      },
      // v2 surface — UI uses these for the first-payout banner and hold
      // notice on the dashboard. Falls back gracefully on pre-v2 accounts.
      v2: {
        firstPayoutHoldActive: (payoutAccount?.completedTxnCount ?? 0) < 3,
        completedTxnCount: payoutAccount?.completedTxnCount ?? 0,
        holdActive: payoutAccount?.holdActive ?? false,
        holdReason: payoutAccount?.holdReason ?? null,
        payoutsEnabled: payoutAccount?.payoutsEnabled ?? false,
      },
      recentPayments,
      stripeConnected: !!guide.stripeAccountId && guide.stripeOnboardingDone,
    };
  }
}
