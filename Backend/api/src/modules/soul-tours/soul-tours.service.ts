import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BookTourDto } from './dto/book-tour.dto';

@Injectable()
export class SoulToursService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireGuide(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new ForbiddenException('Guide profile not found');
    return guide;
  }

  private slug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  }

  // ─── Create Tour ───────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTourDto) {
    const guide = await this.requireGuide(userId);
    const { roomTypes, ...tourData } = dto;

    return this.prisma.soulTour.create({
      data: {
        guideId: guide.id,
        slug: this.slug(dto.title),
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
        basePrice: tourData.basePrice,
        capacity: tourData.capacity,
        spotsRemaining: tourData.capacity,
        coverImageUrl: tourData.coverImageUrl,
        imageUrls: tourData.imageUrls ?? [],
        highlights: tourData.highlights ?? [],
        included: tourData.included ?? [],
        notIncluded: tourData.notIncluded ?? [],
        requirements: tourData.requirements,
        depositMin: tourData.depositMin,
        roomTypes: roomTypes?.length
          ? { create: roomTypes.map((rt, i) => ({ ...rt, available: rt.capacity, sortOrder: i })) }
          : undefined,
      },
      include: { roomTypes: true },
    });
  }

  // ─── List Guide's Tours ────────────────────────────────────────────────────

  async findByGuide(userId: string) {
    const guide = await this.requireGuide(userId);
    return this.prisma.soulTour.findMany({
      where: { guideId: guide.id },
      include: { roomTypes: true, _count: { select: { bookings: true } } },
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

  async findPublished(page = 1, limit = 12) {
    const skip = (page - 1) * limit;
    const [tours, total] = await Promise.all([
      this.prisma.soulTour.findMany({
        where: { isPublished: true, isCancelled: false, startDate: { gte: new Date() } },
        include: {
          roomTypes: { orderBy: { sortOrder: 'asc' }, take: 1 },
          guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } },
        },
        orderBy: { startDate: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.soulTour.count({
        where: { isPublished: true, isCancelled: false, startDate: { gte: new Date() } },
      }),
    ]);
    return { tours, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Update Tour ───────────────────────────────────────────────────────────

  async update(userId: string, tourId: string, dto: UpdateTourDto) {
    const guide = await this.requireGuide(userId);
    const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.guideId !== guide.id) throw new ForbiddenException('Not your tour');

    const { roomTypes, startDate, endDate, ...rest } = dto;
    return this.prisma.soulTour.update({
      where: { id: tourId },
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      include: { roomTypes: true },
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

  // ─── Book Tour (Seeker) ────────────────────────────────────────────────────

  async bookTour(userId: string, dto: BookTourDto) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const tour = await this.prisma.soulTour.findUnique({
      where: { id: dto.tourId },
      include: { roomTypes: true },
    });
    if (!tour || tour.isCancelled) throw new NotFoundException('Tour not found');
    if (tour.spotsRemaining < dto.travelers) throw new BadRequestException('Not enough spots available');

    const roomType = tour.roomTypes.find((rt) => rt.id === dto.roomTypeId);
    if (!roomType) throw new NotFoundException('Room type not found');
    if (roomType.available < dto.travelers) throw new BadRequestException('Not enough rooms available');

    const totalAmount = Number(roomType.totalPrice) * dto.travelers;
    const depositAmount = dto.depositOnly && tour.depositMin
      ? Math.max(Number(tour.depositMin), totalAmount * 0.25)
      : null;

    const booking = await this.prisma.$transaction(async (tx) => {
      // Decrement availability
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
          seekerId: seeker.id,
          roomTypeId: roomType.id,
          travelers: dto.travelers,
          totalAmount,
          depositAmount,
          balanceAmount: depositAmount ? totalAmount - depositAmount : null,
          currency: tour.currency,
          contactFirstName: dto.contactFirstName,
          contactLastName: dto.contactLastName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          specialRequests: dto.specialRequests,
          status: 'PENDING',
        },
        include: { tour: { select: { title: true } }, roomType: { select: { name: true } } },
      });
    });

    return booking;
  }

  // ─── Get Seeker's Tour Bookings ────────────────────────────────────────────

  async findMyBookings(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) return [];
    return this.prisma.tourBooking.findMany({
      where: { seekerId: seeker.id },
      include: {
        tour: { select: { title: true, startDate: true, endDate: true, location: true, coverImageUrl: true } },
        roomType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
