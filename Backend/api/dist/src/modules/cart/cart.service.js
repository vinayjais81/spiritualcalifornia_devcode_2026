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
exports.CartService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let CartService = class CartService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOrCreateCart(userId, sessionId) {
        const where = userId ? { userId } : { sessionId };
        let cart = await this.prisma.cart.findFirst({ where });
        if (!cart) {
            cart = await this.prisma.cart.create({
                data: { userId, sessionId },
            });
        }
        return cart;
    }
    async getCart(userId, sessionId) {
        const cart = await this.getOrCreateCart(userId, sessionId);
        const items = await this.prisma.cartItem.findMany({
            where: { cartId: cart.id },
            orderBy: { createdAt: 'asc' },
        });
        const enrichedItems = await Promise.all(items.map(async (item) => {
            let details = null;
            switch (item.itemType) {
                case 'PRODUCT':
                    details = await this.prisma.product.findUnique({
                        where: { id: item.itemId },
                        select: {
                            id: true, name: true, type: true, price: true, currency: true,
                            imageUrls: true, stockQuantity: true, isActive: true,
                            guide: { select: { displayName: true, slug: true } },
                        },
                    });
                    if (item.variantId) {
                        const variant = await this.prisma.productVariant.findUnique({
                            where: { id: item.variantId },
                            select: { id: true, name: true, price: true, stockQuantity: true, attributes: true },
                        });
                        details = { ...details, selectedVariant: variant };
                    }
                    break;
                case 'EVENT_TICKET':
                    details = await this.prisma.eventTicketTier.findUnique({
                        where: { id: item.itemId },
                        select: {
                            id: true, name: true, price: true, currency: true, capacity: true, sold: true,
                            event: { select: { id: true, title: true, startTime: true, location: true, coverImageUrl: true } },
                        },
                    });
                    break;
                case 'SOUL_TOUR':
                    details = await this.prisma.soulTour.findUnique({
                        where: { id: item.itemId },
                        select: {
                            id: true, title: true, basePrice: true, currency: true, startDate: true,
                            endDate: true, location: true, coverImageUrl: true, spotsRemaining: true,
                        },
                    });
                    break;
                case 'SERVICE_BOOKING':
                    details = await this.prisma.service.findUnique({
                        where: { id: item.itemId },
                        select: {
                            id: true, name: true, type: true, price: true, currency: true, durationMin: true,
                            guide: { select: { displayName: true, slug: true } },
                        },
                    });
                    break;
            }
            return { ...item, details };
        }));
        return { id: cart.id, items: enrichedItems, itemCount: items.length };
    }
    async addItem(dto, userId, sessionId) {
        const cart = await this.getOrCreateCart(userId, sessionId);
        const existing = await this.prisma.cartItem.findFirst({
            where: {
                cartId: cart.id,
                itemType: dto.itemType,
                itemId: dto.itemId,
                variantId: dto.variantId ?? null,
            },
        });
        if (existing) {
            return this.prisma.cartItem.update({
                where: { id: existing.id },
                data: { quantity: existing.quantity + (dto.quantity ?? 1) },
            });
        }
        return this.prisma.cartItem.create({
            data: {
                cartId: cart.id,
                itemType: dto.itemType,
                itemId: dto.itemId,
                variantId: dto.variantId,
                quantity: dto.quantity ?? 1,
                metadata: dto.metadata ?? undefined,
            },
        });
    }
    async updateItem(itemId, dto, userId, sessionId) {
        const cart = await this.getOrCreateCart(userId, sessionId);
        const item = await this.prisma.cartItem.findFirst({
            where: { id: itemId, cartId: cart.id },
        });
        if (!item)
            throw new common_1.NotFoundException('Cart item not found');
        return this.prisma.cartItem.update({
            where: { id: itemId },
            data: { quantity: dto.quantity, metadata: dto.metadata ?? undefined },
        });
    }
    async removeItem(itemId, userId, sessionId) {
        const cart = await this.getOrCreateCart(userId, sessionId);
        const item = await this.prisma.cartItem.findFirst({
            where: { id: itemId, cartId: cart.id },
        });
        if (!item)
            throw new common_1.NotFoundException('Cart item not found');
        await this.prisma.cartItem.delete({ where: { id: itemId } });
        return { deleted: true };
    }
    async clearCart(userId, sessionId) {
        const cart = await this.getOrCreateCart(userId, sessionId);
        await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        return { cleared: true };
    }
    async mergeGuestCart(userId, sessionId) {
        const guestCart = await this.prisma.cart.findFirst({ where: { sessionId } });
        if (!guestCart)
            return;
        const userCart = await this.getOrCreateCart(userId);
        const guestItems = await this.prisma.cartItem.findMany({ where: { cartId: guestCart.id } });
        for (const item of guestItems) {
            const existing = await this.prisma.cartItem.findFirst({
                where: {
                    cartId: userCart.id,
                    itemType: item.itemType,
                    itemId: item.itemId,
                    variantId: item.variantId,
                },
            });
            if (existing) {
                await this.prisma.cartItem.update({
                    where: { id: existing.id },
                    data: { quantity: existing.quantity + item.quantity },
                });
            }
            else {
                await this.prisma.cartItem.create({
                    data: {
                        cartId: userCart.id,
                        itemType: item.itemType,
                        itemId: item.itemId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                        metadata: item.metadata ?? undefined,
                    },
                });
            }
        }
        await this.prisma.cart.delete({ where: { id: guestCart.id } });
    }
};
exports.CartService = CartService;
exports.CartService = CartService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CartService);
//# sourceMappingURL=cart.service.js.map