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
exports.DownloadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const upload_service_1 = require("../upload/upload.service");
let DownloadsService = class DownloadsService {
    prisma;
    uploadService;
    constructor(prisma, uploadService) {
        this.prisma = prisma;
        this.uploadService = uploadService;
    }
    async getDownloadUrl(userId, orderId, orderItemId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, type: true, fileS3Key: true, digitalFiles: true } },
                    },
                },
            },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.seekerId !== seeker.id)
            throw new common_1.ForbiddenException('Not your order');
        if (order.status !== 'PAID' && order.status !== 'DELIVERED') {
            throw new common_1.BadRequestException('Order has not been paid yet');
        }
        const item = order.items.find((i) => i.id === orderItemId);
        if (!item)
            throw new common_1.NotFoundException('Order item not found');
        if (item.product.type !== 'DIGITAL')
            throw new common_1.BadRequestException('This is not a digital product');
        const s3Key = item.product.fileS3Key;
        if (!s3Key)
            throw new common_1.BadRequestException('No file attached to this product');
        const downloadUrl = await this.uploadService.getPresignedDownloadUrl(s3Key, 3600, `${item.product.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${s3Key.split('.').pop() || 'zip'}`);
        await this.prisma.orderItem.update({
            where: { id: orderItemId },
            data: {
                downloadCount: { increment: 1 },
                downloadUrl,
            },
        });
        return {
            downloadUrl,
            fileName: item.product.name,
            fileKey: s3Key,
            downloadCount: item.downloadCount + 1,
        };
    }
    async getMyDownloads(userId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            return [];
        const orders = await this.prisma.order.findMany({
            where: {
                seekerId: seeker.id,
                status: { in: ['PAID', 'DELIVERED'] },
            },
            include: {
                items: {
                    where: { product: { type: 'DIGITAL' } },
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                type: true,
                                fileS3Key: true,
                                digitalFiles: true,
                                imageUrls: true,
                                guide: { select: { displayName: true, slug: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return orders.flatMap((order) => order.items.map((item) => ({
            orderId: order.id,
            orderItemId: item.id,
            productId: item.product.id,
            productName: item.product.name,
            guideName: item.product.guide.displayName,
            guideSlug: item.product.guide.slug,
            imageUrl: item.product.imageUrls?.[0] ?? null,
            digitalFiles: item.product.digitalFiles,
            downloadCount: item.downloadCount,
            purchasedAt: order.createdAt,
            hasFile: !!item.product.fileS3Key,
        })));
    }
};
exports.DownloadsService = DownloadsService;
exports.DownloadsService = DownloadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        upload_service_1.UploadService])
], DownloadsService);
//# sourceMappingURL=downloads.service.js.map