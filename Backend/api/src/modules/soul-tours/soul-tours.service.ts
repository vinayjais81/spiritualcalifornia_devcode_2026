import {
  Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BookTourDto, PayBalanceDto, CancelBookingDto } from './dto/book-tour.dto';
import { StripeService } from '../payments/stripe.service';
import { NotificationsService } from '../notifications/notifications.service';

const HOLD_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_BALANCE_DUE_DAYS = 60;
const DEFAULT_CANCELLATION_POLICY = {
  fullRefundDaysBefore: 90,
  halfRefundDaysBefore: 60,
};

@Injectable()
export class SoulToursService {
  private readonly logger = new Logger(SoulToursService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async requireGuide(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new ForbiddenException('Guide profile not found');
    return guide;
  }

  private slugify(title: string) {
    return (
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString(36)
    );
  }

  private generateBookingReference(tourTitle: string): string {
    const slug = tourTitle
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 6) || 'TOUR';
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `SCT-${slug}-${rand}`;
  }

  private daysBetween(a: Date, b: Date): number {
    return Math.floor((b.getTime() - a.getTime()) / 86400000);
  }

  // ─── Create Tour (with departures + itinerary) ─────────────────────────────

  async create(userId: string, dto: CreateTourDto) {
    const guide = await this.requireGuide(userId);
    const { roomTypes, departures, itinerary, cancellationPolicy, ...tourData } = dto;

    return this.prisma.soulTour.create({
      data: {
        guideId: guide.id,
        slug: this.slugify(dto.title),
        title: tourData.title,
        description: tourData.description,
        shortDesc: tourData.shortDesc,
        startDate: new Date(tourData.startDate),
        endDate: new Date(tourData.endDate),
        timezone: tourData.timezone,
        location: tourData.location,
        address: tourData.address,
        city: tourData.city,
        state: tourData.state,
        country: tourData.country,
        meetingPoint: tourData.meetingPoint,
        basePrice: tourData.basePrice,
        capacity: tourData.capacity,
        spotsRemaining: tourData.capacity,
        coverImageUrl: tourData.coverImageUrl,
        imageUrls: tourData.imageUrls ?? [],
        highlights: tourData.highlights ?? [],
        included: tourData.included ?? [],
        notIncluded: tourData.notIncluded ?? [],
        requirements: tourData.requirements,
        difficultyLevel: tourData.difficultyLevel,
        trackType: tourData.trackType as any,
        latestUpdate: tourData.latestUpdate,
        latestUpdateAt: tourData.latestUpdate ? new Date() : undefined,
        languages: tourData.languages ?? [],
        depositMin: tourData.depositMin,
        minDepositPerPerson: tourData.minDepositPerPerson,
        balanceDueDaysBefore: tourData.balanceDueDaysBefore ?? DEFAULT_BALANCE_DUE_DAYS,
        cancellationPolicy: cancellationPolicy
          ? (cancellationPolicy as unknown as Prisma.InputJsonValue)
          : undefined,
        isPublished: tourData.isPublished ?? false,
        roomTypes: roomTypes?.length
          ? { create: roomTypes.map((rt, i) => ({ ...rt, available: rt.capacity, sortOrder: i })) }
          : undefined,
        departures: departures?.length
          ? {
              create: departures.map((d) => ({
                startDate: new Date(d.startDate),
                endDate: new Date(d.endDate),
                capacity: d.capacity,
                spotsRemaining: d.capacity,
                priceOverride: d.priceOverride,
                notes: d.notes,
              })),
            }
          : undefined,
        itinerary: itinerary?.length
          ? {
              create: itinerary.map((day) => ({
                dayNumber: day.dayNumber,
                title: day.title,
                description: day.description,
                location: day.location,
                meals: day.meals ?? [],
                accommodation: day.accommodation,
                activities: day.activities ?? [],
                imageUrl: day.imageUrl,
              })),
            }
          : undefined,
      },
      include: { roomTypes: true, departures: true, itinerary: true },
    });
  }

  // ─── List Guide's Tours ────────────────────────────────────────────────────

  async findByGuide(userId: string) {
    const guide = await this.requireGuide(userId);
    return this.prisma.soulTour.findMany({
      where: { guideId: guide.id },
      include: {
        roomTypes: true,
        departures: { orderBy: { startDate: 'asc' } },
        _count: { select: { bookings: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  // ─── Get Single Tour (Public) ──────────────────────────────────────────────

  async findOne(slugOrId: string) {
    const tour = await this.prisma.soulTour.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        isPublished: true,
        isCancelled: false,
      },
      include: {
        roomTypes: { orderBy: { sortOrder: 'asc' } },
        departures: {
          where: { status: 'SCHEDULED', startDate: { gte: new Date() } },
          orderBy: { startDate: 'asc' },
        },
        itinerary: { orderBy: { dayNumber: 'asc' } },
        guide: {
          select: {
            id: true, slug: true, displayName: true, isVerified: true, averageRating: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    return tour;
  }

  // ─── List Published Tours (Public) ─────────────────────────────────────────

  async findPublished(
    page = 1,
    limit = 12,
    filters: { track?: string; country?: string } = {},
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.SoulTourWhereInput = {
      isPublished: true,
      isCancelled: false,
      departures: { some: { status: 'SCHEDULED', startDate: { gte: new Date() } } },
    };

    if (filters.track && ['ADVENTURE', 'HEALING'].includes(filters.track)) {
      (where as any).trackType = filters.track;
    }
    if (filters.country && filters.country !== 'all') {
      where.country = { equals: filters.country, mode: 'insensitive' };
    }

    const [tours, total] = await Promise.all([
      this.prisma.soulTour.findMany({
        where,
        include: {
          roomTypes: { orderBy: { sortOrder: 'asc' }, take: 1 },
          departures: {
            where: { status: 'SCHEDULED', startDate: { gte: new Date() } },
            orderBy: { startDate: 'asc' },
            take: 1,
          },
          guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } },
        },
        orderBy: { startDate: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.soulTour.count({ where }),
    ]);
    return { tours, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Public Stats (hero strip on /travels) ────────────────────────────────

  async getPublicStats() {
    const now = new Date();
    const activeWhere: Prisma.SoulTourWhereInput = {
      isPublished: true,
      isCancelled: false,
      departures: { some: { status: 'SCHEDULED', startDate: { gte: now } } },
    };

    const [totalJourneys, countryRows, travelerRows] = await Promise.all([
      this.prisma.soulTour.count({ where: activeWhere }),
      this.prisma.soulTour.findMany({
        where: { ...activeWhere, country: { not: null } },
        select: { country: true },
        distinct: ['country'],
      }),
      this.prisma.tourBookingTraveler.count({
        where: {
          booking: {
            status: { in: ['DEPOSIT_PAID', 'FULLY_PAID', 'CONFIRMED', 'COMPLETED'] },
          },
        },
      }),
    ]);

    return {
      totalJourneys,
      countries: countryRows.length,
      travelers: travelerRows,
      avgRating: 4.9, // Reviews for tours will come online in a later phase
    };
  }

  // ─── Update Tour ───────────────────────────────────────────────────────────

  async update(userId: string, tourId: string, dto: UpdateTourDto) {
    const guide = await this.requireGuide(userId);
    const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.guideId !== guide.id) throw new ForbiddenException('Not your tour');

    const { roomTypes, departures, itinerary, startDate, endDate, cancellationPolicy, trackType, latestUpdate, ...rest } = dto;

    return this.prisma.soulTour.update({
      where: { id: tourId },
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        cancellationPolicy: cancellationPolicy
          ? (cancellationPolicy as unknown as Prisma.InputJsonValue)
          : undefined,
        trackType: trackType as any,
        latestUpdate,
        latestUpdateAt: latestUpdate !== undefined ? new Date() : undefined,
      },
      include: { roomTypes: true, departures: true, itinerary: true },
    });
  }

  // ─── Delete Tour ───────────────────────────────────────────────────────────

  async delete(userId: string, tourId: string) {
    const guide = await this.requireGuide(userId);
    const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.guideId !== guide.id) throw new ForbiddenException('Not your tour');
    await this.prisma.soulTour.delete({ where: { id: tourId } });
    return { deleted: true };
  }

  // ─── Departure management (guide) ──────────────────────────────────────────

  async addDeparture(userId: string, tourId: string, dto: { startDate: string; endDate: string; capacity: number; priceOverride?: number; notes?: string }) {
    const guide = await this.requireGuide(userId);
    const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.guideId !== guide.id) throw new ForbiddenException('Not your tour');

    return this.prisma.tourDeparture.create({
      data: {
        tourId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        capacity: dto.capacity,
        spotsRemaining: dto.capacity,
        priceOverride: dto.priceOverride,
        notes: dto.notes,
      },
    });
  }

  async cancelDeparture(userId: string, tourId: string, departureId: string) {
    const guide = await this.requireGuide(userId);
    const departure = await this.prisma.tourDeparture.findUnique({
      where: { id: departureId },
      include: { tour: true },
    });
    if (!departure || departure.tourId !== tourId) throw new NotFoundException('Departure not found');
    if (departure.tour.guideId !== guide.id) throw new ForbiddenException('Not your tour');

    return this.prisma.tourDeparture.update({
      where: { id: departureId },
      data: { status: 'CANCELLED' },
    });
  }

  // ─── Itinerary management (guide) ──────────────────────────────────────────

  async replaceItinerary(userId: string, tourId: string, days: { dayNumber: number; title: string; description: string; location?: string; meals?: string[]; accommodation?: string; activities?: string[]; imageUrl?: string }[]) {
    const guide = await this.requireGuide(userId);
    const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.guideId !== guide.id) throw new ForbiddenException('Not your tour');

    return this.prisma.$transaction(async (tx) => {
      await tx.tourItineraryDay.deleteMany({ where: { tourId } });
      if (days.length) {
        await tx.tourItineraryDay.createMany({
          data: days.map((d) => ({
            tourId,
            dayNumber: d.dayNumber,
            title: d.title,
            description: d.description,
            location: d.location,
            meals: d.meals ?? [],
            accommodation: d.accommodation,
            activities: d.activities ?? [],
            imageUrl: d.imageUrl,
          })),
        });
      }
      return tx.tourItineraryDay.findMany({ where: { tourId }, orderBy: { dayNumber: 'asc' } });
    });
  }

  // ─── Book Tour (Seeker) ────────────────────────────────────────────────────

  async bookTour(userId: string, dto: BookTourDto) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    // Validate manifest count matches travelers count
    if (!dto.travelersDetails || dto.travelersDetails.length !== dto.travelers) {
      throw new BadRequestException(
        `travelersDetails must contain exactly ${dto.travelers} entries`,
      );
    }
    const primaryCount = dto.travelersDetails.filter((t) => t.isPrimary).length;
    if (primaryCount !== 1) {
      throw new BadRequestException('Exactly one traveler must be marked as primary');
    }

    // Load tour + departure + room
    const tour = await this.prisma.soulTour.findUnique({
      where: { id: dto.tourId },
      include: { roomTypes: true },
    });
    if (!tour || tour.isCancelled) throw new NotFoundException('Tour not found');

    const departure = await this.prisma.tourDeparture.findUnique({
      where: { id: dto.departureId },
    });
    if (!departure || departure.tourId !== tour.id) {
      throw new NotFoundException('Departure not found');
    }
    if (departure.status !== 'SCHEDULED') {
      throw new BadRequestException('Departure is not bookable');
    }
    if (departure.spotsRemaining < dto.travelers) {
      throw new BadRequestException('Not enough spots available on this departure');
    }

    const roomType = tour.roomTypes.find((rt) => rt.id === dto.roomTypeId);
    if (!roomType) throw new NotFoundException('Room type not found');
    if (roomType.available < dto.travelers) {
      throw new BadRequestException('Not enough rooms available');
    }

    // Pricing — honor per-departure price override if present
    const perPerson = departure.priceOverride
      ? Number(departure.priceOverride)
      : Number(roomType.totalPrice);
    const totalAmount = perPerson * dto.travelers;

    // Validate user's chosen deposit
    const minDepositPerPerson = tour.minDepositPerPerson
      ? Number(tour.minDepositPerPerson)
      : 500;
    const minDepositTotal = Math.max(
      minDepositPerPerson * dto.travelers,
      tour.depositMin ? Number(tour.depositMin) : 0,
    );
    if (dto.chosenDepositAmount < minDepositTotal) {
      throw new BadRequestException(
        `Deposit must be at least $${minDepositTotal.toFixed(2)}`,
      );
    }
    if (dto.chosenDepositAmount > totalAmount) {
      throw new BadRequestException('Deposit cannot exceed total amount');
    }

    const balanceAmount = totalAmount - dto.chosenDepositAmount;
    const balanceDueDays = tour.balanceDueDaysBefore ?? DEFAULT_BALANCE_DUE_DAYS;
    const balanceDueAt = new Date(
      departure.startDate.getTime() - balanceDueDays * 86400000,
    );
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);
    const bookingReference = this.generateBookingReference(tour.title);

    const primary = dto.travelersDetails.find((t) => t.isPrimary)!;

    // Validate every traveler has the required identity fields filled in
    // (frontend should already enforce, but `@IsString()` allows empty strings).
    dto.travelersDetails.forEach((t, i) => {
      if (!t.firstName?.trim()) throw new BadRequestException(`Traveler ${i + 1}: first name is required`);
      if (!t.lastName?.trim()) throw new BadRequestException(`Traveler ${i + 1}: last name is required`);
      if (!t.dateOfBirth) throw new BadRequestException(`Traveler ${i + 1}: date of birth is required`);
      if (!t.nationality?.trim()) throw new BadRequestException(`Traveler ${i + 1}: nationality is required`);
    });

    // Transactional create + inventory decrement
    const booking = await this.prisma.$transaction(async (tx) => {
      // Re-check inventory inside the transaction (race protection)
      const freshDeparture = await tx.tourDeparture.findUnique({
        where: { id: departure.id },
      });
      if (!freshDeparture || freshDeparture.spotsRemaining < dto.travelers) {
        throw new BadRequestException('Departure spots taken while you were booking');
      }
      const freshRoom = await tx.tourRoomType.findUnique({ where: { id: roomType.id } });
      if (!freshRoom || freshRoom.available < dto.travelers) {
        throw new BadRequestException('Room availability changed while you were booking');
      }

      await tx.tourDeparture.update({
        where: { id: departure.id },
        data: { spotsRemaining: { decrement: dto.travelers } },
      });
      await tx.soulTour.update({
        where: { id: tour.id },
        data: { spotsRemaining: { decrement: dto.travelers } },
      });
      await tx.tourRoomType.update({
        where: { id: roomType.id },
        data: { available: { decrement: dto.travelers } },
      });

      return tx.tourBooking.create({
        data: {
          tourId: tour.id,
          departureId: departure.id,
          seekerId: seeker.id,
          roomTypeId: roomType.id,
          travelers: dto.travelers,
          totalAmount,
          depositAmount: dto.chosenDepositAmount,
          chosenDepositAmount: dto.chosenDepositAmount,
          balanceAmount,
          balanceDueAt,
          holdExpiresAt,
          bookingReference,
          paymentMethod: dto.paymentMethod ?? 'STRIPE_CARD',
          currency: tour.currency,
          status: 'PENDING',
          dietaryRequirements: dto.dietaryRequirements,
          dietaryNotes: dto.dietaryNotes,
          healthConditions: dto.healthConditions,
          intentions: dto.intentions,
          specialRequests: dto.specialRequests,
          contactFirstName: primary.firstName,
          contactLastName: primary.lastName,
          contactEmail: primary.email ?? '',
          contactPhone: primary.phone,
          travelers_rel: {
            create: dto.travelersDetails.map((t) => ({
              isPrimary: t.isPrimary,
              firstName: t.firstName,
              lastName: t.lastName,
              dateOfBirth: new Date(t.dateOfBirth),
              nationality: t.nationality,
              email: t.email,
              phone: t.phone,
            })),
          },
        },
        include: {
          tour: { select: { title: true, slug: true } },
          roomType: { select: { name: true } },
          departure: { select: { startDate: true, endDate: true } },
          travelers_rel: true,
        },
      });
    });

    this.logger.log(
      `TourBooking created: ${booking.id} (${bookingReference}) — ${dto.travelers} travelers, deposit $${dto.chosenDepositAmount}`,
    );

    return booking;
  }

  // ─── Pay Balance (Seeker) ──────────────────────────────────────────────────

  async getBalanceDue(userId: string, bookingId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const booking = await this.prisma.tourBooking.findUnique({
      where: { id: bookingId },
      include: { tour: { select: { title: true, currency: true, guideId: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.seekerId !== seeker.id) throw new ForbiddenException('Not your booking');
    if (booking.status !== 'DEPOSIT_PAID') {
      throw new BadRequestException('Balance can only be paid after deposit is confirmed');
    }
    return {
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      tourTitle: booking.tour.title,
      currency: booking.currency,
      totalAmount: Number(booking.totalAmount),
      depositPaid: Number(booking.depositAmount ?? 0),
      balanceDue: Number(booking.balanceAmount ?? 0),
      balanceDueAt: booking.balanceDueAt,
    };
  }

  // ─── Cancel Booking (Seeker) ───────────────────────────────────────────────

  /**
   * Compute the refund amount based on the tour's cancellation policy and
   * how many days remain until departure.
   * Returns: { refundAmount, refundPercent, tier: 'FULL'|'HALF'|'NONE' }
   */
  private computeRefund(
    paid: number,
    departureDate: Date,
    policy: { fullRefundDaysBefore: number; halfRefundDaysBefore: number },
  ) {
    const daysUntil = this.daysBetween(new Date(), departureDate);
    if (daysUntil >= policy.fullRefundDaysBefore) {
      return { refundAmount: paid, refundPercent: 100, tier: 'FULL' as const };
    }
    if (daysUntil >= policy.halfRefundDaysBefore) {
      return { refundAmount: paid / 2, refundPercent: 50, tier: 'HALF' as const };
    }
    return { refundAmount: 0, refundPercent: 0, tier: 'NONE' as const };
  }

  async cancelBooking(userId: string, bookingId: string, dto: CancelBookingDto) {
    const seeker = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const booking = await this.prisma.tourBooking.findUnique({
      where: { id: bookingId },
      include: { tour: true, departure: true, payments: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.seekerId !== seeker.id) throw new ForbiddenException('Not your booking');
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking already cancelled');
    }
    if (!booking.departure) {
      throw new BadRequestException('Booking has no departure attached');
    }

    const policy =
      (booking.tour.cancellationPolicy as unknown as {
        fullRefundDaysBefore: number;
        halfRefundDaysBefore: number;
      }) ?? DEFAULT_CANCELLATION_POLICY;

    const succeededPayments = booking.payments.filter((p) => p.status === 'SUCCEEDED');
    const totalPaid = succeededPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const refund = this.computeRefund(totalPaid, booking.departure.startDate, policy);

    // 1. Release inventory + mark cancelled
    const updated = await this.prisma.$transaction(async (tx) => {
      if (booking.departureId) {
        await tx.tourDeparture.update({
          where: { id: booking.departureId },
          data: { spotsRemaining: { increment: booking.travelers } },
        });
      }
      await tx.soulTour.update({
        where: { id: booking.tourId },
        data: { spotsRemaining: { increment: booking.travelers } },
      });
      await tx.tourRoomType.update({
        where: { id: booking.roomTypeId },
        data: { available: { increment: booking.travelers } },
      });
      return tx.tourBooking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
        },
      });
    });

    // 2. Execute Stripe refunds (proportional split across SUCCEEDED payments).
    //    We refund each payment's pro-rata share of the total refund amount.
    if (refund.refundAmount > 0 && totalPaid > 0) {
      for (const payment of succeededPayments) {
        const share = (Number(payment.amount) / totalPaid) * refund.refundAmount;
        if (share <= 0) continue;
        try {
          const stripeRefund = await this.stripeService.createRefund(
            payment.stripePaymentIntentId,
            share,
          );
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status:
                share >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
              refundedAmount: share,
              stripeRefundId: stripeRefund.id,
            },
          });
          this.logger.log(
            `Stripe refund issued for payment ${payment.id}: $${share.toFixed(2)} (tier=${refund.tier})`,
          );
        } catch (err: any) {
          // Log the error but don't fail the cancellation — admin can retry the refund manually
          this.logger.error(
            `Stripe refund failed for payment ${payment.id}: ${err.message}. Cancellation remains in effect; admin must retry refund.`,
          );
        }
      }
    }

    this.logger.log(
      `TourBooking cancelled: ${booking.id} — refund tier=${refund.tier} amount=$${refund.refundAmount}`,
    );

    // 3. Send cancellation email + in-app notification (fire-and-forget)
    if (seeker.user) {
      this.notifications
        .notifyTourCancelled({
          seekerUserId: seeker.user.id,
          seekerEmail: booking.contactEmail || seeker.user.email,
          seekerName: booking.contactFirstName || seeker.user.firstName || 'there',
          tourTitle: booking.tour.title,
          bookingReference: booking.bookingReference || booking.id.slice(-8).toUpperCase(),
          refundAmount: `$${refund.refundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          refundTier: refund.tier,
          cancellationReason: dto.reason || null,
        })
        .catch((err) =>
          this.logger.error(`Cancellation notification failed for booking ${booking.id}: ${err.message}`),
        );
    }

    return {
      booking: updated,
      refund,
    };
  }

  // ─── Get Booking Detail (seeker or guide) ──────────────────────────────────

  async getBookingForSeeker(userId: string, bookingId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const booking = await this.prisma.tourBooking.findUnique({
      where: { id: bookingId },
      include: {
        tour: {
          select: {
            title: true, slug: true, location: true, coverImageUrl: true,
            meetingPoint: true, currency: true,
          },
        },
        roomType: { select: { name: true, description: true } },
        departure: true,
        travelers_rel: true,
        payments: { select: { id: true, amount: true, status: true, paymentType: true, createdAt: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.seekerId !== seeker.id) throw new ForbiddenException('Not your booking');

    return booking;
  }

  // ─── Manifest viewer (guide) ───────────────────────────────────────────────

  async getManifest(userId: string, tourId: string, departureId?: string) {
    const guide = await this.requireGuide(userId);
    const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.guideId !== guide.id) throw new ForbiddenException('Not your tour');

    const bookings = await this.prisma.tourBooking.findMany({
      where: {
        tourId,
        ...(departureId ? { departureId } : {}),
        status: { in: ['DEPOSIT_PAID', 'FULLY_PAID', 'CONFIRMED', 'COMPLETED'] },
      },
      include: {
        roomType: { select: { name: true } },
        departure: { select: { startDate: true, endDate: true } },
        travelers_rel: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Decrypt passports for the guide who owns the tour
    return bookings.map((b) => ({
      bookingId: b.id,
      bookingReference: b.bookingReference,
      status: b.status,
      travelers: b.travelers,
      roomType: b.roomType.name,
      departure: b.departure,
      dietaryRequirements: b.dietaryRequirements,
      dietaryNotes: b.dietaryNotes,
      healthConditions: b.healthConditions,
      contactEmail: b.contactEmail,
      contactPhone: b.contactPhone,
      manifest: b.travelers_rel.map((t) => ({
        isPrimary: t.isPrimary,
        firstName: t.firstName,
        lastName: t.lastName,
        dateOfBirth: t.dateOfBirth,
        nationality: t.nationality,
        email: t.email,
        phone: t.phone,
      })),
    }));
  }

  // ─── Get Seeker's Tour Bookings ────────────────────────────────────────────

  async findMyBookings(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) return [];
    const bookings = await this.prisma.tourBooking.findMany({
      where: { seekerId: seeker.id },
      include: {
        tour: { select: { title: true, slug: true, location: true, coverImageUrl: true } },
        roomType: { select: { name: true } },
        departure: { select: { startDate: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return bookings;
  }

  // ─── Hold Reaper (called by BullMQ cron) ───────────────────────────────────

  /**
   * Releases inventory for PENDING bookings whose 24h hold has expired.
   * Called by tour-hold-reaper BullMQ job (Phase F). Exposed here so a
   * cron / one-off script can call it directly.
   */
  async releaseExpiredHolds(): Promise<{ released: number }> {
    const now = new Date();
    const expired = await this.prisma.tourBooking.findMany({
      where: {
        status: 'PENDING',
        holdExpiresAt: { lt: now },
      },
      select: {
        id: true, tourId: true, departureId: true, roomTypeId: true, travelers: true,
      },
    });

    let released = 0;
    for (const b of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (b.departureId) {
            await tx.tourDeparture.update({
              where: { id: b.departureId },
              data: { spotsRemaining: { increment: b.travelers } },
            });
          }
          await tx.soulTour.update({
            where: { id: b.tourId },
            data: { spotsRemaining: { increment: b.travelers } },
          });
          await tx.tourRoomType.update({
            where: { id: b.roomTypeId },
            data: { available: { increment: b.travelers } },
          });
          await tx.tourBooking.update({
            where: { id: b.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: now,
              cancellationReason: 'Hold expired (24h without payment)',
            },
          });
        });
        released++;
      } catch (err: any) {
        this.logger.error(`Failed to release hold for booking ${b.id}: ${err.message}`);
      }
    }

    if (released > 0) {
      this.logger.log(`Released ${released} expired tour booking holds`);
    }
    return { released };
  }

}
