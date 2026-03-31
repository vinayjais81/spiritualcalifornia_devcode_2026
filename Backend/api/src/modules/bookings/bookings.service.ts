import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: { seeker: { select: { userId: true } }, service: { select: { guide: { select: { userId: true } } } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const isSeeker = booking.seeker.userId === userId;
    const isGuide = booking.service.guide.userId === userId;
    if (!isSeeker && !isGuide) throw new ForbiddenException('Access denied');
    if (booking.status === 'CANCELLED') throw new BadRequestException('Already cancelled');

    return this.prisma.$transaction(async (tx) => {
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
