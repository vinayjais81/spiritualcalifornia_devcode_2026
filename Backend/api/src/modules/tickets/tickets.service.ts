import {
  Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { EventCheckoutDto } from './dto/event-checkout.dto';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ─── Event Ticket Checkout ─────────────────────────────────────────────────

  async eventCheckout(userId: string, dto: EventCheckoutDto) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    if (dto.attendees.length !== dto.quantity) {
      throw new BadRequestException(`Expected ${dto.quantity} attendees, got ${dto.attendees.length}`);
    }

    // Load event + tier
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      include: {
        guide: {
          select: { id: true, displayName: true, stripeAccountId: true, user: { select: { firstName: true, lastName: true } } },
        },
        ticketTiers: true,
      },
    });
    if (!event || !event.isPublished) throw new NotFoundException('Event not found or not published');
    if (event.isCancelled) throw new BadRequestException('This event has been cancelled');

    const tier = event.ticketTiers.find((t) => t.id === dto.tierId);
    if (!tier || !tier.isActive) throw new NotFoundException('Ticket tier not found or inactive');

    const remaining = tier.capacity - tier.sold;
    if (remaining < dto.quantity) {
      throw new BadRequestException(`Only ${remaining} ticket${remaining !== 1 ? 's' : ''} remaining`);
    }

    const pricePerTicket = Number(tier.price);
    const subtotal = pricePerTicket * dto.quantity;
    const bookingFeeRate = 0.05; // 5%
    const bookingFee = Math.round(subtotal * bookingFeeRate * 100) / 100;
    const totalAmount = subtotal + bookingFee;

    const purchaseGroupId = randomBytes(16).toString('hex');

    // Create one TicketPurchase per attendee in a transaction
    const purchases = await this.prisma.$transaction(async (tx) => {
      // Re-check availability inside transaction
      const freshTier = await tx.eventTicketTier.findUnique({ where: { id: tier.id } });
      if (!freshTier || (freshTier.capacity - freshTier.sold) < dto.quantity) {
        throw new BadRequestException('Tickets sold out while processing');
      }

      const created: Awaited<ReturnType<typeof tx.ticketPurchase.create>>[] = [];
      for (const attendee of dto.attendees) {
        const ticket = await tx.ticketPurchase.create({
          data: {
            purchaseGroupId,
            seekerId: seeker.id,
            tierId: tier.id,
            quantity: 1,
            totalAmount: pricePerTicket,
            bookingFee: bookingFee / dto.quantity, // split fee evenly
            status: 'PENDING',
            attendeeName: `${attendee.firstName} ${attendee.lastName}`,
            attendeeEmail: attendee.email,
            dietaryNeeds: attendee.dietaryNeeds || null,
            accessibilityNeeds: attendee.accessibilityNeeds || null,
          },
        });
        created.push(ticket);
      }
      return created;
    });

    // Use the first purchase ID for the payment link (all grouped by purchaseGroupId)
    const primaryPurchase = purchases[0];
    const guideName = event.guide.displayName || `${event.guide.user.firstName} ${event.guide.user.lastName}`;

    const paymentResult = await this.paymentsService.createPaymentIntent({
      amount: totalAmount,
      currency: tier.currency.toLowerCase(),
      ticketPurchaseId: primaryPurchase.id,
      metadata: {
        eventId: event.id,
        eventTitle: event.title,
        tierId: tier.id,
        tierName: tier.name,
        quantity: dto.quantity,
        purchaseGroupId,
        guideName,
        primaryAttendeeEmail: dto.attendees[0].email,
      },
    });

    this.logger.log(
      `Event checkout: ${dto.quantity} × "${tier.name}" for "${event.title}" → group ${purchaseGroupId}`,
    );

    return {
      purchaseGroupId,
      ticketPurchaseIds: purchases.map((p) => p.id),
      clientSecret: paymentResult.clientSecret,
      paymentIntentId: paymentResult.paymentIntentId,
      event: {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        type: event.type,
      },
      tier: {
        id: tier.id,
        name: tier.name,
        price: pricePerTicket,
        currency: tier.currency,
      },
      summary: {
        quantity: dto.quantity,
        subtotal,
        bookingFee,
        total: totalAmount,
      },
    };
  }

  // ─── Confirm tickets after payment (called after Stripe webhook) ───────────

  async confirmPurchaseGroup(purchaseGroupId: string) {
    const tickets = await this.prisma.ticketPurchase.findMany({
      where: { purchaseGroupId },
      include: {
        tier: { include: { event: { select: { id: true, title: true, startTime: true, endTime: true, location: true, type: true } } } },
      },
    });
    if (!tickets.length) return;
    if (tickets[0].status === 'CONFIRMED') return; // Idempotent

    // Generate QR codes + confirm all tickets
    const frontendUrl = process.env.FRONTEND_URL || 'https://spiritualcalifornia.com';
    for (const ticket of tickets) {
      const verifyUrl = `${frontendUrl}/verify-ticket/${ticket.id}`;
      const qrCode = await QRCode.toDataURL(verifyUrl, {
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

    // Increment sold count on tier
    const tierId = tickets[0].tierId;
    await this.prisma.eventTicketTier.update({
      where: { id: tierId },
      data: { sold: { increment: tickets.length } },
    });

    this.logger.log(`Confirmed ${tickets.length} tickets for group ${purchaseGroupId}`);
  }

  // ─── Get purchase group details (for confirmation page) ────────────────────

  async getPurchaseGroup(userId: string, purchaseGroupId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const tickets = await this.prisma.ticketPurchase.findMany({
      where: { purchaseGroupId, seekerId: seeker.id },
      include: {
        tier: {
          include: {
            event: {
              select: {
                id: true, title: true, startTime: true, endTime: true,
                location: true, type: true, coverImageUrl: true,
                guide: { select: { displayName: true, user: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        },
        payment: { select: { id: true, amount: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!tickets.length) throw new NotFoundException('Purchase not found');

    return {
      purchaseGroupId,
      status: tickets[0].status,
      event: tickets[0].tier.event,
      tier: { id: tickets[0].tier.id, name: tickets[0].tier.name, price: Number(tickets[0].tier.price) },
      tickets: tickets.map((t) => ({
        id: t.id,
        attendeeName: t.attendeeName,
        attendeeEmail: t.attendeeEmail,
        dietaryNeeds: t.dietaryNeeds,
        accessibilityNeeds: t.accessibilityNeeds,
        qrCode: t.qrCode,
        status: t.status,
      })),
      summary: {
        quantity: tickets.length,
        subtotal: tickets.reduce((sum, t) => sum + Number(t.totalAmount), 0),
        bookingFee: tickets.reduce((sum, t) => sum + Number(t.bookingFee), 0),
        total: tickets.reduce((sum, t) => sum + Number(t.totalAmount) + Number(t.bookingFee), 0),
      },
    };
  }

  // ─── Verify Ticket (public — scanned QR code) ──────────────────────────────

  async verifyTicket(ticketId: string) {
    const ticket = await this.prisma.ticketPurchase.findUnique({
      where: { id: ticketId },
      include: {
        tier: {
          include: {
            event: {
              select: {
                id: true, title: true, startTime: true, endTime: true,
                timezone: true, location: true, type: true, coverImageUrl: true,
                guide: { select: { displayName: true, user: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const event = ticket.tier.event;
    const guideName = event.guide.displayName || `${event.guide.user.firstName} ${event.guide.user.lastName}`;

    return {
      ticketId: ticket.id,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt,
      attendee: {
        name: ticket.attendeeName,
        email: ticket.attendeeEmail,
        dietaryNeeds: ticket.dietaryNeeds,
        accessibilityNeeds: ticket.accessibilityNeeds,
      },
      tier: {
        name: ticket.tier.name,
        price: Number(ticket.tier.price),
        currency: ticket.tier.currency,
      },
      event: {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
        location: event.location,
        type: event.type,
        coverImageUrl: event.coverImageUrl,
        guideName,
      },
      purchasedAt: ticket.createdAt,
    };
  }

  // ─── Check In Ticket (guide/admin scans at the door) ──────────────────────

  async checkInTicket(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticketPurchase.findUnique({
      where: { id: ticketId },
      include: { tier: { include: { event: { select: { title: true } } } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== 'CONFIRMED') {
      throw new BadRequestException(`Cannot check in — ticket status is ${ticket.status}`);
    }
    if (ticket.checkedInAt) {
      throw new BadRequestException(
        `Already checked in at ${ticket.checkedInAt.toISOString()}`,
      );
    }

    const updated = await this.prisma.ticketPurchase.update({
      where: { id: ticketId },
      data: { checkedInAt: new Date(), checkedInBy: userId },
    });

    this.logger.log(
      `Ticket ${ticketId} checked in by ${userId} for "${ticket.tier.event.title}"`,
    );

    return {
      ticketId: updated.id,
      checkedInAt: updated.checkedInAt,
      checkedInBy: updated.checkedInBy,
      attendeeName: updated.attendeeName,
    };
  }

  // ─── Get seeker's event tickets (grouped by purchase) ──────────────────────

  async getMyEventTickets(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    // Get all ticket purchases grouped by purchaseGroupId
    const tickets = await this.prisma.ticketPurchase.findMany({
      where: { seekerId: seeker.id },
      include: {
        tier: {
          include: {
            event: {
              select: {
                id: true, title: true, startTime: true, endTime: true, timezone: true,
                location: true, type: true, coverImageUrl: true, isCancelled: true,
                guide: { select: { displayName: true, user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
              },
            },
          },
        },
        payment: { select: { id: true, amount: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by purchaseGroupId
    const groups = new Map<string, typeof tickets>();
    for (const t of tickets) {
      const arr = groups.get(t.purchaseGroupId) || [];
      arr.push(t);
      groups.set(t.purchaseGroupId, arr);
    }

    return Array.from(groups.entries()).map(([groupId, tix]) => {
      const first = tix[0];
      const event = first.tier.event;
      const guideName = event.guide.displayName || `${event.guide.user.firstName} ${event.guide.user.lastName}`;

      return {
        purchaseGroupId: groupId,
        status: first.status,
        ticketCount: tix.length,
        totalAmount: tix.reduce((sum, t) => sum + Number(t.totalAmount), 0),
        bookingFee: tix.reduce((sum, t) => sum + Number(t.bookingFee), 0),
        createdAt: first.createdAt,
        event: {
          id: event.id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          timezone: event.timezone,
          location: event.location,
          type: event.type,
          coverImageUrl: event.coverImageUrl,
          isCancelled: event.isCancelled,
        },
        tier: { name: first.tier.name, price: Number(first.tier.price) },
        guide: {
          name: guideName,
          avatarUrl: event.guide.user.avatarUrl,
        },
        tickets: tix.map((t) => ({
          id: t.id,
          attendeeName: t.attendeeName,
          attendeeEmail: t.attendeeEmail,
          qrCode: t.qrCode,
          status: t.status,
        })),
      };
    });
  }
}
