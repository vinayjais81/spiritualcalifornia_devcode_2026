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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const payments_service_1 = require("../payments/payments.service");
const checkout_service_1 = require("../checkout/checkout.service");
let OrdersService = class OrdersService {
    prisma;
    paymentsService;
    checkoutService;
    constructor(prisma, paymentsService, checkoutService) {
        this.prisma = prisma;
        this.paymentsService = paymentsService;
        this.checkoutService = checkoutService;
    }
    async create(userId, dto) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const itemDetails = await Promise.all(dto.items.map(async (item) => {
            const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
            if (!product || !product.isActive)
                throw new common_1.NotFoundException(`Product ${item.productId} not found`);
            let unitPrice = Number(product.price);
            if (item.variantId) {
                const variant = await this.prisma.productVariant.findUnique({ where: { id: item.variantId } });
                if (!variant || variant.productId !== product.id)
                    throw new common_1.BadRequestException('Invalid variant');
                if (variant.stockQuantity < item.quantity)
                    throw new common_1.BadRequestException(`Insufficient stock for ${variant.name}`);
                if (variant.price)
                    unitPrice = Number(variant.price);
            }
            else if (product.type === 'PHYSICAL' && product.stockQuantity !== null && product.stockQuantity < item.quantity) {
                throw new common_1.BadRequestException(`Insufficient stock for ${product.name}`);
            }
            return { product, unitPrice, quantity: item.quantity, variantId: item.variantId };
        }));
        const subtotal = itemDetails.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const hasPhysical = itemDetails.some((i) => i.product.type === 'PHYSICAL');
        let shippingCost = 0;
        if (hasPhysical && dto.shippingMethodId) {
            const method = await this.checkoutService.getShippingMethod(dto.shippingMethodId);
            shippingCost = Number(method.price);
        }
        let discountAmount = 0;
        let promoCodeId;
        if (dto.promoCode) {
            const promo = await this.checkoutService.validatePromoCode(dto.promoCode, subtotal);
            discountAmount = promo.discountAmount;
            promoCodeId = promo.promoCodeId;
        }
        const state = dto.shippingAddress?.state;
        let taxRate = 0;
        let taxAmount = 0;
        if (hasPhysical && state) {
            const tax = await this.checkoutService.calculateTax(state, subtotal - discountAmount);
            taxRate = tax.rate;
            taxAmount = tax.taxAmount;
        }
        const totalAmount = subtotal - discountAmount + shippingCost + taxAmount;
        const order = await this.prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    seekerId: seeker.id,
                    subtotal,
                    discountAmount,
                    shippingCost,
                    taxAmount,
                    taxRate,
                    totalAmount,
                    contactEmail: dto.contactEmail,
                    contactFirstName: dto.contactFirstName,
                    contactLastName: dto.contactLastName,
                    contactPhone: dto.contactPhone,
                    shippingAddress: dto.shippingAddress ? dto.shippingAddress : undefined,
                    shippingMethodId: dto.shippingMethodId,
                    promoCodeId,
                    notes: dto.notes,
                    status: 'PENDING',
                    items: {
                        create: itemDetails.map((i) => ({
                            productId: i.product.id,
                            variantId: i.variantId,
                            quantity: i.quantity,
                            unitPrice: i.unitPrice,
                        })),
                    },
                },
                include: { items: { include: { product: { select: { name: true, type: true, imageUrls: true } } } } },
            });
            if (promoCodeId) {
                await tx.promoCode.update({ where: { id: promoCodeId }, data: { usedCount: { increment: 1 } } });
            }
            return newOrder;
        });
        const paymentIntent = await this.paymentsService.createPaymentIntent({
            amount: totalAmount,
            orderId: order.id,
        });
        return { order, paymentIntent };
    }
    async findMyOrders(userId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            return [];
        return this.prisma.order.findMany({
            where: { seekerId: seeker.id },
            include: {
                items: { include: { product: { select: { name: true, type: true, imageUrls: true } } } },
                payment: { select: { status: true, paymentMethod: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(userId, orderId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { product: true } },
                payment: true,
                promoCode: { select: { code: true, type: true, amount: true } },
                shippingMethod: { select: { name: true, estimatedDaysMin: true, estimatedDaysMax: true } },
            },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (seeker && order.seekerId !== seeker.id)
            throw new common_1.ForbiddenException('Access denied');
        return order;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        payments_service_1.PaymentsService,
        checkout_service_1.CheckoutService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map