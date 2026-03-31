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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let ProductsService = class ProductsService {
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
        return this.prisma.product.create({
            data: {
                guideId: guide.id,
                name: dto.name,
                type: dto.type,
                price: dto.price,
                description: dto.description,
                fileS3Key: dto.fileS3Key,
                digitalFiles: dto.digitalFiles ?? undefined,
                imageUrls: dto.imageUrls ?? [],
                stockQuantity: dto.stockQuantity,
                isActive: false,
            },
        });
    }
    async findByGuide(userId) {
        const guide = await this.requireGuide(userId);
        return this.prisma.product.findMany({
            where: { guideId: guide.id },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findActiveByGuideId(guideId) {
        return this.prisma.product.findMany({
            where: { guideId, isActive: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(productId) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: {
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
        if (!product)
            throw new common_1.NotFoundException('Product not found');
        return product;
    }
    async update(userId, productId, dto) {
        const guide = await this.requireGuide(userId);
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product)
            throw new common_1.NotFoundException('Product not found');
        if (product.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your product');
        return this.prisma.product.update({
            where: { id: productId },
            data: dto,
        });
    }
    async delete(userId, productId) {
        const guide = await this.requireGuide(userId);
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product)
            throw new common_1.NotFoundException('Product not found');
        if (product.guideId !== guide.id)
            throw new common_1.ForbiddenException('Not your product');
        await this.prisma.product.delete({ where: { id: productId } });
        return { deleted: true };
    }
    async publishAll(guideId) {
        await this.prisma.product.updateMany({
            where: { guideId, isActive: false },
            data: { isActive: true },
        });
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
//# sourceMappingURL=products.service.js.map