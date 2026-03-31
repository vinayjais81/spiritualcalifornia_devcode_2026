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
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let EventsService = class EventsService {
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
    async create(userId, dto) {
        const guide = await this.requireGuide(userId);
        const startTime = new Date(dto.startTime);
        const endTime = dto.endTime
            ? new Date(dto.endTime)
            : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
        const event = await this.prisma.event.create({
            data: {
                guideId: guide.id,
                title: dto.title,
                type: dto.type,
                startTime,
                endTime,
                timezone: dto.timezone ?? guide.timezone ?? 'America/Los_Angeles',
                location: dto.location,
                description: dto.description,
                isPublished: false,
            },
        });
        if (dto.ticketPrice !== undefined && dto.ticketPrice >= 0) {
            await this.prisma.eventTicketTier.create({
                data: {
                    eventId: event.id,
                    name: 'General Admission',
                    price: dto.ticketPrice,
                    capacity: dto.ticketCapacity ?? 100,
                },
            });
        }
        return this.prisma.event.findUnique({
            where: { id: event.id },
            include: { ticketTiers: true },
        });
    }
    async findByGuide(userId) {
        const guide = await this.requireGuide(userId);
        return this.prisma.event.findMany({
            where: { guideId: guide.id },
            include: { ticketTiers: true },
            orderBy: { startTime: 'asc' },
        });
    }
    async findPublishedByGuideId(guideId) {
        return this.prisma.event.findMany({
            where: { guideId, isPublished: true, isCancelled: false },
            include: { ticketTiers: true },
            orderBy: { startTime: 'asc' },
        });
    }
    async findPublished(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [events, total] = await Promise.all([
            this.prisma.event.findMany({
                where: { isPublished: true, isCancelled: false, startTime: { gte: new Date() } },
                include: {
                    ticketTiers: { where: { isActive: true } },
                    guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } },
                },
                orderBy: { startTime: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.event.count({
                where: { isPublished: true, isCancelled: false, startTime: { gte: new Date() } },
            }),
        ]);
        return { events, total, page, totalPages: Math.ceil(total / limit) };
    }
    async findOne(eventId) {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            include: {
                ticketTiers: true,
                guide: {
                    select: {
                        id: true,
                        slug: true,
                        displayName: true,
                        isVerified: true,
                        user: { select: { avatarUrl: true } },
                    },
                },
            },
        });
        if (!event)
            throw new common_1.NotFoundException('Event not found');
        return event;
    }
    async update(userId, eventId, dto) {
        const guide = await this.requireGuide(userId);
        const event = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (!event)
            throw new common_1.NotFoundException('Event not found');
        if (event.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your event');
        const data = {};
        if (dto.title !== undefined)
            data.title = dto.title;
        if (dto.type !== undefined)
            data.type = dto.type;
        if (dto.startTime !== undefined)
            data.startTime = new Date(dto.startTime);
        if (dto.endTime !== undefined)
            data.endTime = new Date(dto.endTime);
        if (dto.location !== undefined)
            data.location = dto.location;
        if (dto.description !== undefined)
            data.description = dto.description;
        if (dto.coverImageUrl !== undefined)
            data.coverImageUrl = dto.coverImageUrl;
        if (dto.timezone !== undefined)
            data.timezone = dto.timezone;
        if (dto.isPublished !== undefined)
            data.isPublished = dto.isPublished;
        if (dto.isCancelled !== undefined)
            data.isCancelled = dto.isCancelled;
        return this.prisma.event.update({
            where: { id: eventId },
            data,
            include: { ticketTiers: true },
        });
    }
    async delete(userId, eventId) {
        const guide = await this.requireGuide(userId);
        const event = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (!event)
            throw new common_1.NotFoundException('Event not found');
        if (event.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your event');
        await this.prisma.event.delete({ where: { id: eventId } });
        return { deleted: true };
    }
    async publishAll(guideId) {
        await this.prisma.event.updateMany({
            where: { guideId, isPublished: false },
            data: { isPublished: true },
        });
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EventsService);
//# sourceMappingURL=events.service.js.map