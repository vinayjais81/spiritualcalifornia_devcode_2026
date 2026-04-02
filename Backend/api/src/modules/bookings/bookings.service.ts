import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateServiceBookingDto } from './dto/create-service-booking.dto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ─── Service Booking Checkout (Calendly-first flow) ─────────────────────────

  async createServiceBooking(userId: string, dto: CreateServiceBookingDto) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: { guide: { select: { id: true, displayName: true, slug: true, stripeAccountId: true } } },
    });
    if (!service || !service.isActive) throw new NotFoundException('Service not found or inactive');

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (startTime >= endTime) throw new BadRequestException('Invalid time range');
    if (startTime <= new Date()) throw new BadRequestException('Cannot book in the past');

    // Check for overlapping booked slots for this guide
    const existingSlot = await this.prisma.serviceSlot.findFirst({
      where: {
        service: { guideId: service.guideId },
        isBooked: true,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (existingSlot) throw new BadRequestException('This time slot is no longer available');

    // Create slot + booking in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the service slot for this Calendly-selected time
      const slot = await tx.serviceSlot.create({
        data: {
          serviceId: service.id,
          startTime,
          endTime,
          isBooked: true,
        },
      });

      // Create the booking
      const booking = await tx.booking.create({
        data: {
          seekerId: seeker.id,
          serviceId: service.id,
          slotId: slot.id,
          totalAmount: service.price,
          currency: service.currency,
          status: 'PENDING',
          notes: [
            dto.sessionNotes ? `Session notes: ${dto.sessionNotes}` : '',
            dto.experienceLevel ? `Experience: ${dto.experienceLevel}` : '',
            dto.healthConditions ? `Health: ${dto.healthConditions}` : '',
            dto.referralSource ? `Found via: ${dto.referralSource}` : '',
          ].filter(Boolean).join('\n') || undefined,
        },
      });

      return { slot, booking };
    });

    // Create Stripe PaymentIntent (paymentsService expects dollars, not cents)
    const priceInDollars = Number(service.price);
    const paymentResult = await this.paymentsService.createPaymentIntent({
      amount: priceInDollars,
      currency: service.currency.toLowerCase(),
      bookingId: result.booking.id,
      metadata: {
        serviceId: service.id,
        serviceName: service.name,
        guideName: service.guide.displayName,
        guideSlug: service.guide.slug,
        seekerEmail: dto.email,
        seekerName: `${dto.firstName} ${dto.lastName}`,
        calendlyEventUri: dto.calendlyEventUri || '',
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });

    this.logger.log(
      `Service booking created: ${result.booking.id} for ${dto.firstName} ${dto.lastName} ` +
      `→ ${service.name} with ${service.guide.displayName}`,
    );

    return {
      bookingId: result.booking.id,
      clientSecret: paymentResult.clientSecret,
      paymentIntentId: paymentResult.paymentIntentId,
      service: {
        name: service.name,
        type: service.type,
        durationMin: service.durationMin,
        price: Number(service.price),
        currency: service.currency,
      },
      guide: {
        displayName: service.guide.displayName,
        slug: service.guide.slug,
      },
      slot: {
        startTime: result.slot.startTime.toISOString(),
        endTime: result.slot.endTime.toISOString(),
      },
    };
  }

  // ─── Create Booking (Seeker) ───────────────────────────────────────────────

  async create(userId: string, dto: CreateBookingDto) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service || !service.isActive) throw new NotFoundException('Service not found or inactive');

    const slot = await this.prisma.serviceSlot.findUnique({ where: { id: dto.slotId } });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.serviceId !== service.id) throw new BadRequestException('Slot does not belong to this service');
    if (slot.isBooked || slot.isBlocked) throw new BadRequestException('Slot is not available');

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceSlot.update({ where: { id: slot.id }, data: { isBooked: true } });

      return tx.booking.create({
        data: {
          seekerId: seeker.id,
          serviceId: service.id,
          slotId: slot.id,
          totalAmount: service.price,
          currency: service.currency,
          notes: dto.notes,
          status: 'PENDING',
        },
        include: {
          service: { select: { name: true, type: true, durationMin: true, guide: { select: { displayName: true, slug: true } } } },
          slot: { select: { startTime: true, endTime: true } },
        },
      });
    });
  }

  // ─── List Seeker's Bookings ────────────────────────────────────────────────

  async findMySeekerBookings(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) return [];
    return this.prisma.booking.findMany({
      where: { seekerId: seeker.id },
      include: {
        service: { select: { name: true, type: true, guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } } } },
        slot: { select: { startTime: true, endTime: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── List Guide's Bookings ─────────────────────────────────────────────────

  async findMyGuideBookings(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new ForbiddenException('Guide profile not found');
    return this.prisma.booking.findMany({
      where: { service: { guideId: guide.id } },
      include: {
        service: { select: { name: true, type: true, durationMin: true } },
        slot: { select: { startTime: true, endTime: true } },
        seeker: { select: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Get Single Booking ────────────────────────────────────────────────────

  async findOne(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { include: { guide: { select: { displayName: true, slug: true, userId: true, user: { select: { avatarUrl: true } } } } } },
        slot: true,
        seeker: { select: { userId: true, user: { select: { firstName: true, lastName: true, email: true } } } },
        payment: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Authorization: must be the seeker or the guide
    const isSeeker = booking.seeker.userId === userId;
    const isGuide = booking.service.guide.userId === userId;
    if (!isSeeker && !isGuide) throw new ForbiddenException('Access denied');

    return booking;
  }

  // ─── Cancel Booking ────────────────────────────────────────────────────────

  async cancel(userId: string, bookingId: string, reason?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        seeker: { select: { userId: true } },
        service: { select: { guide: { select: { userId: true } } } },
        slot: { select: { startTime: true } },
        payment: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const isSeeker = booking.seeker.userId === userId;
    const isGuide = booking.service.guide.userId === userId;
    if (!isSeeker && !isGuide) throw new ForbiddenException('Access denied');
    if (booking.status === 'CANCELLED') throw new BadRequestException('Already cancelled');

    // Cancel booking + release slot
    const cancelled = await this.prisma.$transaction(async (tx) => {
      await tx.serviceSlot.update({ where: { id: booking.slotId }, data: { isBooked: false } });

      return tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: userId,
          cancellationReason: reason,
        },
      });
    });

    // Process Stripe refund if payment was successful
    if (booking.payment && booking.payment.status === 'SUCCEEDED') {
      try {
        const now = new Date();
        const sessionStart = booking.slot?.startTime;
        const hoursUntilSession = sessionStart
          ? (new Date(sessionStart).getTime() - now.getTime()) / (1000 * 60 * 60)
          : Infinity;

        // Refund policy: 48+ hours = full, <48 hours = 50%, no-show = 0
        let refundPercent = 0;
        if (hoursUntilSession >= 48) {
          refundPercent = 100;
        } else if (hoursUntilSession > 0) {
          refundPercent = 50;
        }

        if (refundPercent > 0) {
          const refundAmount = Math.round(Number(booking.payment.amount) * (refundPercent / 100));
          await this.paymentsService.refund(booking.payment.id, refundAmount);
          this.logger.log(
            `Booking ${bookingId} cancelled — ${refundPercent}% refund ($${refundAmount.toFixed(2)}) processed`,
          );
        } else {
          this.logger.log(`Booking ${bookingId} cancelled — no refund (past session time)`);
        }
      } catch (err) {
        this.logger.error(`Failed to process refund for booking ${bookingId}: ${err}`);
        // Don't throw — cancellation succeeded, refund failure is logged
      }
    }

    return cancelled;
  }

  // ─── Confirm Booking (Guide) ───────────────────────────────────────────────

  async confirm(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: { select: { guide: { select: { userId: true } } } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.service.guide.userId !== userId) throw new ForbiddenException('Not your booking');

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
    });
  }

  // ─── Complete Booking (Guide) ──────────────────────────────────────────────

  async complete(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: { select: { guide: { select: { userId: true } } } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.service.guide.userId !== userId) throw new ForbiddenException('Not your booking');

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}
