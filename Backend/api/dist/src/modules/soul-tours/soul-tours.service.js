"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SoulToursService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoulToursService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../../database/prisma.service");
const passport_cipher_1 = require("../../common/crypto/passport-cipher");
const stripe_service_1 = require("../payments/stripe.service");
const notifications_service_1 = require("../notifications/notifications.service");
const HOLD_DURATION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BALANCE_DUE_DAYS = 60;
const DEFAULT_CANCELLATION_POLICY = {
    fullRefundDaysBefore: 90,
    halfRefundDaysBefore: 60,
};
let SoulToursService = SoulToursService_1 = class SoulToursService {
    prisma;
    stripeService;
    notifications;
    logger = new common_1.Logger(SoulToursService_1.name);
    constructor(prisma, stripeService, notifications) {
        this.prisma = prisma;
        this.stripeService = stripeService;
        this.notifications = notifications;
    }
    async requireGuide(userId) {
        const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
        if (!guide)
            throw new common_1.ForbiddenException('Guide profile not found');
        return guide;
    }
    slugify(title) {
        return (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
            '-' +
            Date.now().toString(36));
    }
    generateBookingReference(tourTitle) {
        const slug = tourTitle
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '')
            .slice(0, 6) || 'TOUR';
        const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
        return `SCT-${slug}-${rand}`;
    }
    daysBetween(a, b) {
        return Math.floor((b.getTime() - a.getTime()) / 86400000);
    }
    async create(userId, dto) {
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
                languages: tourData.languages ?? [],
                depositMin: tourData.depositMin,
                minDepositPerPerson: tourData.minDepositPerPerson,
                balanceDueDaysBefore: tourData.balanceDueDaysBefore ?? DEFAULT_BALANCE_DUE_DAYS,
                cancellationPolicy: cancellationPolicy
                    ? cancellationPolicy
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
    async findByGuide(userId) {
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
    async findOne(slugOrId) {
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
        if (!tour)
            throw new common_1.NotFoundException('Tour not found');
        return tour;
    }
    async findPublished(page = 1, limit = 12) {
        const skip = (page - 1) * limit;
        const where = {
            isPublished: true,
            isCancelled: false,
            departures: { some: { status: 'SCHEDULED', startDate: { gte: new Date() } } },
        };
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
    async update(userId, tourId, dto) {
        const guide = await this.requireGuide(userId);
        const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
        if (!tour)
            throw new common_1.NotFoundException('Tour not found');
        if (tour.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your tour');
        const { roomTypes, departures, itinerary, startDate, endDate, cancellationPolicy, ...rest } = dto;
        return this.prisma.soulTour.update({
            where: { id: tourId },
            data: {
                ...rest,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                cancellationPolicy: cancellationPolicy
                    ? cancellationPolicy
                    : undefined,
            },
            include: { roomTypes: true, departures: true, itinerary: true },
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
    async addDeparture(userId, tourId, dto) {
        const guide = await this.requireGuide(userId);
        const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
        if (!tour)
            throw new common_1.NotFoundException('Tour not found');
        if (tour.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your tour');
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
    async cancelDeparture(userId, tourId, departureId) {
        const guide = await this.requireGuide(userId);
        const departure = await this.prisma.tourDeparture.findUnique({
            where: { id: departureId },
            include: { tour: true },
        });
        if (!departure || departure.tourId !== tourId)
            throw new common_1.NotFoundException('Departure not found');
        if (departure.tour.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your tour');
        return this.prisma.tourDeparture.update({
            where: { id: departureId },
            data: { status: 'CANCELLED' },
        });
    }
    async replaceItinerary(userId, tourId, days) {
        const guide = await this.requireGuide(userId);
        const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
        if (!tour)
            throw new common_1.NotFoundException('Tour not found');
        if (tour.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your tour');
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
    async bookTour(userId, dto) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        if (!dto.travelersDetails || dto.travelersDetails.length !== dto.travelers) {
            throw new common_1.BadRequestException(`travelersDetails must contain exactly ${dto.travelers} entries`);
        }
        const primaryCount = dto.travelersDetails.filter((t) => t.isPrimary).length;
        if (primaryCount !== 1) {
            throw new common_1.BadRequestException('Exactly one traveler must be marked as primary');
        }
        const tour = await this.prisma.soulTour.findUnique({
            where: { id: dto.tourId },
            include: { roomTypes: true },
        });
        if (!tour || tour.isCancelled)
            throw new common_1.NotFoundException('Tour not found');
        const departure = await this.prisma.tourDeparture.findUnique({
            where: { id: dto.departureId },
        });
        if (!departure || departure.tourId !== tour.id) {
            throw new common_1.NotFoundException('Departure not found');
        }
        if (departure.status !== 'SCHEDULED') {
            throw new common_1.BadRequestException('Departure is not bookable');
        }
        if (departure.spotsRemaining < dto.travelers) {
            throw new common_1.BadRequestException('Not enough spots available on this departure');
        }
        const roomType = tour.roomTypes.find((rt) => rt.id === dto.roomTypeId);
        if (!roomType)
            throw new common_1.NotFoundException('Room type not found');
        if (roomType.available < dto.travelers) {
            throw new common_1.BadRequestException('Not enough rooms available');
        }
        const perPerson = departure.priceOverride
            ? Number(departure.priceOverride)
            : Number(roomType.totalPrice);
        const totalAmount = perPerson * dto.travelers;
        const minDepositPerPerson = tour.minDepositPerPerson
            ? Number(tour.minDepositPerPerson)
            : 500;
        const minDepositTotal = Math.max(minDepositPerPerson * dto.travelers, tour.depositMin ? Number(tour.depositMin) : 0);
        if (dto.chosenDepositAmount < minDepositTotal) {
            throw new common_1.BadRequestException(`Deposit must be at least $${minDepositTotal.toFixed(2)}`);
        }
        if (dto.chosenDepositAmount > totalAmount) {
            throw new common_1.BadRequestException('Deposit cannot exceed total amount');
        }
        const balanceAmount = totalAmount - dto.chosenDepositAmount;
        const balanceDueDays = tour.balanceDueDaysBefore ?? DEFAULT_BALANCE_DUE_DAYS;
        const balanceDueAt = new Date(departure.startDate.getTime() - balanceDueDays * 86400000);
        const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);
        const bookingReference = this.generateBookingReference(tour.title);
        const primary = dto.travelersDetails.find((t) => t.isPrimary);
        const encryptedTravelers = dto.travelersDetails.map((t) => ({
            ...t,
            passportNumberEncrypted: (0, passport_cipher_1.encryptPassport)(t.passportNumber),
        }));
        const booking = await this.prisma.$transaction(async (tx) => {
            const freshDeparture = await tx.tourDeparture.findUnique({
                where: { id: departure.id },
            });
            if (!freshDeparture || freshDeparture.spotsRemaining < dto.travelers) {
                throw new common_1.BadRequestException('Departure spots taken while you were booking');
            }
            const freshRoom = await tx.tourRoomType.findUnique({ where: { id: roomType.id } });
            if (!freshRoom || freshRoom.available < dto.travelers) {
                throw new common_1.BadRequestException('Room availability changed while you were booking');
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
                        create: encryptedTravelers.map((t) => ({
                            isPrimary: t.isPrimary,
                            firstName: t.firstName,
                            lastName: t.lastName,
                            dateOfBirth: new Date(t.dateOfBirth),
                            nationality: t.nationality,
                            passportNumber: t.passportNumberEncrypted,
                            passportExpiry: new Date(t.passportExpiry),
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
        this.logger.log(`TourBooking created: ${booking.id} (${bookingReference}) — ${dto.travelers} travelers, deposit $${dto.chosenDepositAmount}`);
        return this.scrubBooking(booking);
    }
    async getBalanceDue(userId, bookingId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const booking = await this.prisma.tourBooking.findUnique({
            where: { id: bookingId },
            include: { tour: { select: { title: true, currency: true, guideId: true } } },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.seekerId !== seeker.id)
            throw new common_1.ForbiddenException('Not your booking');
        if (booking.status !== 'DEPOSIT_PAID') {
            throw new common_1.BadRequestException('Balance can only be paid after deposit is confirmed');
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
    computeRefund(paid, departureDate, policy) {
        const daysUntil = this.daysBetween(new Date(), departureDate);
        if (daysUntil >= policy.fullRefundDaysBefore) {
            return { refundAmount: paid, refundPercent: 100, tier: 'FULL' };
        }
        if (daysUntil >= policy.halfRefundDaysBefore) {
            return { refundAmount: paid / 2, refundPercent: 50, tier: 'HALF' };
        }
        return { refundAmount: 0, refundPercent: 0, tier: 'NONE' };
    }
    async cancelBooking(userId, bookingId, dto) {
        const seeker = await this.prisma.seekerProfile.findUnique({
            where: { userId },
            include: { user: { select: { id: true, email: true, firstName: true } } },
        });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const booking = await this.prisma.tourBooking.findUnique({
            where: { id: bookingId },
            include: { tour: true, departure: true, payments: true },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.seekerId !== seeker.id)
            throw new common_1.ForbiddenException('Not your booking');
        if (booking.status === 'CANCELLED') {
            throw new common_1.BadRequestException('Booking already cancelled');
        }
        if (!booking.departure) {
            throw new common_1.BadRequestException('Booking has no departure attached');
        }
        const policy = booking.tour.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY;
        const succeededPayments = booking.payments.filter((p) => p.status === 'SUCCEEDED');
        const totalPaid = succeededPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const refund = this.computeRefund(totalPaid, booking.departure.startDate, policy);
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
        if (refund.refundAmount > 0 && totalPaid > 0) {
            for (const payment of succeededPayments) {
                const share = (Number(payment.amount) / totalPaid) * refund.refundAmount;
                if (share <= 0)
                    continue;
                try {
                    const stripeRefund = await this.stripeService.createRefund(payment.stripePaymentIntentId, share);
                    await this.prisma.payment.update({
                        where: { id: payment.id },
                        data: {
                            status: share >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                            refundedAmount: share,
                            stripeRefundId: stripeRefund.id,
                        },
                    });
                    this.logger.log(`Stripe refund issued for payment ${payment.id}: $${share.toFixed(2)} (tier=${refund.tier})`);
                }
                catch (err) {
                    this.logger.error(`Stripe refund failed for payment ${payment.id}: ${err.message}. Cancellation remains in effect; admin must retry refund.`);
                }
            }
        }
        this.logger.log(`TourBooking cancelled: ${booking.id} — refund tier=${refund.tier} amount=$${refund.refundAmount}`);
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
                .catch((err) => this.logger.error(`Cancellation notification failed for booking ${booking.id}: ${err.message}`));
        }
        return {
            booking: updated,
            refund,
        };
    }
    async getBookingForSeeker(userId, bookingId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
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
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.seekerId !== seeker.id)
            throw new common_1.ForbiddenException('Not your booking');
        return this.scrubBooking(booking);
    }
    async getManifest(userId, tourId, departureId) {
        const guide = await this.requireGuide(userId);
        const tour = await this.prisma.soulTour.findUnique({ where: { id: tourId } });
        if (!tour)
            throw new common_1.NotFoundException('Tour not found');
        if (tour.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your tour');
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
            manifest: b.travelers_rel.map((t) => {
                let passportNumber = '';
                let passportMasked = '';
                try {
                    passportNumber = (0, passport_cipher_1.decryptPassport)(t.passportNumber);
                    passportMasked = (0, passport_cipher_1.maskPassport)(passportNumber);
                }
                catch (err) {
                    this.logger.error(`Failed to decrypt passport for traveler ${t.id}`);
                    passportMasked = '<decrypt-failed>';
                }
                return {
                    isPrimary: t.isPrimary,
                    firstName: t.firstName,
                    lastName: t.lastName,
                    dateOfBirth: t.dateOfBirth,
                    nationality: t.nationality,
                    passportNumber,
                    passportMasked,
                    passportExpiry: t.passportExpiry,
                    email: t.email,
                    phone: t.phone,
                };
            }),
        }));
    }
    async findMyBookings(userId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            return [];
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
    async releaseExpiredHolds() {
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
            }
            catch (err) {
                this.logger.error(`Failed to release hold for booking ${b.id}: ${err.message}`);
            }
        }
        if (released > 0) {
            this.logger.log(`Released ${released} expired tour booking holds`);
        }
        return { released };
    }
    scrubBooking(booking) {
        if (booking.travelers_rel) {
            booking.travelers_rel = booking.travelers_rel.map((t) => ({
                ...t,
                passportNumber: undefined,
            }));
        }
        return booking;
    }
};
exports.SoulToursService = SoulToursService;
exports.SoulToursService = SoulToursService = SoulToursService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stripe_service_1.StripeService,
        notifications_service_1.NotificationsService])
], SoulToursService);
//# sourceMappingURL=soul-tours.service.js.map