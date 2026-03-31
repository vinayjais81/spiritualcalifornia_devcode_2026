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
var ServicesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let ServicesService = ServicesService_1 = class ServicesService {
    prisma;
    logger = new common_1.Logger(ServicesService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        const guide = await this.findGuideOrFail(userId);
        const service = await this.prisma.service.create({
            data: {
                guideId: guide.id,
                name: dto.name,
                description: dto.description,
                type: dto.type,
                price: dto.price,
                durationMin: dto.durationMin,
            },
        });
        this.logger.log(`Service "${service.name}" created for guide ${guide.id}`);
        return service;
    }
    async findByGuide(userId) {
        const guide = await this.findGuideOrFail(userId);
        return this.prisma.service.findMany({
            where: { guideId: guide.id },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findByGuideId(guideId) {
        return this.prisma.service.findMany({
            where: { guideId, isActive: true },
            orderBy: { createdAt: 'asc' },
        });
    }
    async findOne(serviceId) {
        const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
            include: {
                guide: {
                    select: {
                        id: true,
                        slug: true,
                        displayName: true,
                        isVerified: true,
                        user: {
                            select: { avatarUrl: true },
                        },
                    },
                },
            },
        });
        if (!service) {
            throw new common_1.NotFoundException('Service not found');
        }
        return service;
    }
    async update(userId, serviceId, dto) {
        const guide = await this.findGuideOrFail(userId);
        const service = await this.findServiceOrFail(serviceId);
        if (service.guideId !== guide.id) {
            throw new common_1.ForbiddenException('You can only edit your own services');
        }
        const updated = await this.prisma.service.update({
            where: { id: serviceId },
            data: dto,
        });
        this.logger.log(`Service "${updated.name}" updated by guide ${guide.id}`);
        return updated;
    }
    async delete(userId, serviceId) {
        const guide = await this.findGuideOrFail(userId);
        const service = await this.findServiceOrFail(serviceId);
        if (service.guideId !== guide.id) {
            throw new common_1.ForbiddenException('You can only delete your own services');
        }
        await this.prisma.service.delete({ where: { id: serviceId } });
        this.logger.log(`Service "${service.name}" deleted by guide ${guide.id}`);
        return { deleted: true };
    }
    async activateAll(guideId) {
        await this.prisma.service.updateMany({
            where: { guideId },
            data: { isActive: true },
        });
    }
    async findGuideOrFail(userId) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { userId },
        });
        if (!guide) {
            throw new common_1.NotFoundException('Guide profile not found. Complete onboarding first.');
        }
        return guide;
    }
    async findServiceOrFail(serviceId) {
        const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
        });
        if (!service) {
            throw new common_1.NotFoundException('Service not found');
        }
        return service;
    }
};
exports.ServicesService = ServicesService;
exports.ServicesService = ServicesService = ServicesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ServicesService);
//# sourceMappingURL=services.service.js.map