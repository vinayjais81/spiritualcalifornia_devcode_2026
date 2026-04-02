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
var BookingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const payments_service_1 = require("../payments/payments.service");
let BookingsService = BookingsService_1 = class BookingsService {
    prisma;
    paymentsService;
    logger = new common_1.Logger(BookingsService_1.name);
    constructor(prisma, paymentsService) {
        this.prisma = prisma;
        this.paymentsService = paymentsService;
    }
    async createServiceBooking(userId, dto) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const service = await this.prisma.service.findUnique({
            where: { id: dto.serviceId },
            include: { guide: { select: { id: true, displayName: true, slug: true, stripeAccountId: true } } },
        });
        if (!service || !service.isActive)
            throw new common_1.NotFoundException('Service not found or inactive');
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);
        if (startTime >= endTime)
            throw new common_1.BadRequestException('Invalid time range');
        if (startTime <= new Date())
            throw new common_1.BadRequestException('Cannot book in the past');
        const existingSlot = await this.prisma.serviceSlot.findFirst({
            where: {
                service: { guideId: service.guideId },
                isBooked: true,
                startTime: { lt: endTime },
                endTime: { gt: startTime },
            },
        });
        if (existingSlot)
            throw new common_1.BadRequestException('This time slot is no longer available');
        const result = await this.prisma.$transaction(async (tx) => {
            const slot = await tx.serviceSlot.create({
                data: {
                    serviceId: service.id,
                    startTime,
                    endTime,
                    isBooked: true,
                },
            });
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
        const priceInCents = Math.round(Number(service.price) * 100);
        const paymentResult = await this.paymentsService.createPaymentIntent({
            amount: priceInCents,
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
        this.logger.log(`Service booking created: ${result.booking.id} for ${dto.firstName} ${dto.lastName} ` +
            `→ ${service.name} with ${service.guide.displayName}`);
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
    async create(userId, dto) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
        if (!service || !service.isActive)
            throw new common_1.NotFoundException('Service not found or inactive');
        const slot = await this.prisma.serviceSlot.findUnique({ where: { id: dto.slotId } });
        if (!slot)
            throw new common_1.NotFoundException('Slot not found');
        if (slot.serviceId !== service.id)
            throw new common_1.BadRequestException('Slot does not belong to this service');
        if (slot.isBooked || slot.isBlocked)
            throw new common_1.BadRequestException('Slot is not available');
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
    async findMySeekerBookings(userId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            return [];
        return this.prisma.booking.findMany({
            where: { seekerId: seeker.id },
            include: {
                service: { select: { name: true, type: true, guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } } } },
                slot: { select: { startTime: true, endTime: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findMyGuideBookings(userId) {
        const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
        if (!guide)
            throw new common_1.ForbiddenException('Guide profile not found');
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
    async findOne(userId, bookingId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                service: { include: { guide: { select: { displayName: true, slug: true, userId: true, user: { select: { avatarUrl: true } } } } } },
                slot: true,
                seeker: { select: { userId: true, user: { select: { firstName: true, lastName: true, email: true } } } },
                payment: true,
            },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        const isSeeker = booking.seeker.userId === userId;
        const isGuide = booking.service.guide.userId === userId;
        if (!isSeeker && !isGuide)
            throw new common_1.ForbiddenException('Access denied');
        return booking;
    }
    async cancel(userId, bookingId, reason) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { seeker: { select: { userId: true } }, service: { select: { guide: { select: { userId: true } } } } },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        const isSeeker = booking.seeker.userId === userId;
        const isGuide = booking.service.guide.userId === userId;
        if (!isSeeker && !isGuide)
            throw new common_1.ForbiddenException('Access denied');
        if (booking.status === 'CANCELLED')
            throw new common_1.BadRequestException('Already cancelled');
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
    async confirm(userId, bookingId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { service: { select: { guide: { select: { userId: true } } } } },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.service.guide.userId !== userId)
            throw new common_1.ForbiddenException('Not your booking');
        return this.prisma.booking.update({
            where: { id: bookingId },
            data: { status: 'CONFIRMED' },
        });
    }
    async complete(userId, bookingId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { service: { select: { guide: { select: { userId: true } } } } },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.service.guide.userId !== userId)
            throw new common_1.ForbiddenException('Not your booking');
        return this.prisma.booking.update({
            where: { id: bookingId },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = BookingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        payments_service_1.PaymentsService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map