"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoulToursService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let SoulToursService = class SoulToursService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async requireGuide(userId) {
        const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
        if (!guide)
            throw new common_1.ForbiddenException('Guide profile not found');
        return guide;
    }
    slug(title) {
        return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
    }
    async create(userId, dto) {
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
    async findByGuide(userId) {
        const guide = await this.requireGuide(userId);
        return this.prisma.soulTour.findMany({
            where: { guideId: guide.id },
            include: { roomTypes: true, _count: { select: { bookings: true } } },
            orderBy: { startDate: 'asc' },
        });
    }
    async findOne(slugOrId) {
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
        if (!tour)
            throw new common_1.NotFoundException('Tour not found');
        return tour;
    }
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
    async update(userId, tourId, dto) {
        const guide = await this.requireGuide(userId);
        const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
        if (!tour)
            throw new common_1.NotFoundException('Tour not found');
        if (tour.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your tour');
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
    async delete(userId, tourId) {
        const guide = await this.requireGuide(userId);
        const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
        if (!tour)
            throw new common_1.NotFoundException('Tour not found');
        if (tour.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your tour');
        await this.prisma.soulTour.delete({ where: { id: tourId } });
        return { deleted: true };
    }
    async bookTour(userId, dto) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const tour = await this.prisma.soulTour.findUnique({
            where: { id: dto.tourId },
            include: { roomTypes: true },
        });
        if (!tour || tour.isCancelled)
            throw new common_1.NotFoundException('Tour not found');
        if (tour.spotsRemaining < dto.travelers)
            throw new common_1.BadRequestException('Not enough spots available');
        const roomType = tour.roomTypes.find((rt) => rt.id === dto.roomTypeId);
        if (!roomType)
            throw new common_1.NotFoundException('Room type not found');
        if (roomType.available < dto.travelers)
            throw new common_1.BadRequestException('Not enough rooms available');
        const totalAmount = Number(roomType.totalPrice) * dto.travelers;
        const depositAmount = dto.depositOnly && tour.depositMin
            ? Math.max(Number(tour.depositMin), totalAmount * 0.25)
            : null;
        const booking = await this.prisma.$transaction(async (tx) => {
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
    async findMyBookings(userId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            return [];
        return this.prisma.tourBooking.findMany({
            where: { seekerId: seeker.id },
            include: {
                tour: { select: { title: true, startDate: true, endDate: true, location: true, coverImageUrl: true } },
                roomType: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.SoulToursService = SoulToursService;
exports.SoulToursService = SoulToursService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SoulToursService);
//# sourceMappingURL=soul-tours.service.js.map