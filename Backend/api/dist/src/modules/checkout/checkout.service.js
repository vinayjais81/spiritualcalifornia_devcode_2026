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
exports.CheckoutService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const cache_service_1 = require("../../database/cache.service");
let CheckoutService = class CheckoutService {
    prisma;
    cache;
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    async getShippingMethods() {
        return this.cache.getOrSet(cache_service_1.CacheService.keys.shippingMethods(), () => this.prisma.shippingMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }), 3600);
    }
    async getShippingMethod(id) {
        const method = await this.prisma.shippingMethod.findUnique({ where: { id } });
        if (!method || !method.isActive)
            throw new common_1.NotFoundException('Shipping method not found');
        return method;
    }
    async calculateTax(state, taxableAmount) {
        const taxRate = await this.prisma.taxRate.findFirst({
            where: { state: state.toUpperCase(), country: 'US', isActive: true },
        });
        if (!taxRate) {
            return { rate: 0, taxAmount: 0, name: 'No tax' };
        }
        const rate = Number(taxRate.rate);
        const taxAmount = Math.round(taxableAmount * rate * 100) / 100;
        return { rate, taxAmount, name: taxRate.name };
    }
    async getTaxRates() {
        return this.prisma.taxRate.findMany({
            where: { isActive: true },
            orderBy: { state: 'asc' },
        });
    }
    async validatePromoCode(code, subtotal) {
        const promo = await this.prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
        if (!promo)
            throw new common_1.NotFoundException('Promo code not found');
        if (!promo.isActive)
            throw new common_1.BadRequestException('Promo code is inactive');
        if (promo.expiresAt && promo.expiresAt < new Date())
            throw new common_1.BadRequestException('Promo code has expired');
        if (promo.startsAt && promo.startsAt > new Date())
            throw new common_1.BadRequestException('Promo code is not yet active');
        if (promo.maxUses && promo.usedCount >= promo.maxUses)
            throw new common_1.BadRequestException('Promo code usage limit reached');
        if (promo.minOrderAmount && subtotal < Number(promo.minOrderAmount)) {
            throw new common_1.BadRequestException(`Minimum order amount is $${promo.minOrderAmount}`);
        }
        let discountAmount;
        if (promo.type === 'PERCENTAGE') {
            discountAmount = Math.round(subtotal * (Number(promo.amount) / 100) * 100) / 100;
            if (promo.maxDiscountAmount) {
                discountAmount = Math.min(discountAmount, Number(promo.maxDiscountAmount));
            }
        }
        else {
            discountAmount = Math.min(Number(promo.amount), subtotal);
        }
        return {
            promoCodeId: promo.id,
            code: promo.code,
            type: promo.type,
            discountAmount,
            description: promo.type === 'PERCENTAGE'
                ? `${promo.amount}% off`
                : `$${promo.amount} off`,
        };
    }
    async calculateOrderSummary(data) {
        let subtotal = 0;
        const itemDetails = await Promise.all(data.items.map(async (item) => {
            const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
            if (!product)
                throw new common_1.NotFoundException(`Product ${item.productId} not found`);
            let unitPrice = Number(product.price);
            if (item.variantId) {
                const variant = await this.prisma.productVariant.findUnique({ where: { id: item.variantId } });
                if (variant?.price)
                    unitPrice = Number(variant.price);
            }
            const lineTotal = unitPrice * item.quantity;
            subtotal += lineTotal;
            return { name: product.name, type: product.type, unitPrice, quantity: item.quantity, lineTotal };
        }));
        const hasPhysical = itemDetails.some((i) => i.type === 'PHYSICAL');
        let shippingCost = 0;
        let shippingMethod = null;
        if (hasPhysical && data.shippingMethodId) {
            const method = await this.getShippingMethod(data.shippingMethodId);
            shippingCost = Number(method.price);
            shippingMethod = { name: method.name, estimatedDaysMin: method.estimatedDaysMin, estimatedDaysMax: method.estimatedDaysMax };
        }
        let discountAmount = 0;
        let promoDetails = null;
        if (data.promoCode) {
            try {
                const promo = await this.validatePromoCode(data.promoCode, subtotal);
                discountAmount = promo.discountAmount;
                promoDetails = promo;
            }
            catch {
            }
        }
        let taxAmount = 0;
        let taxDetails = null;
        if (hasPhysical && data.state) {
            const tax = await this.calculateTax(data.state, subtotal - discountAmount);
            taxAmount = tax.taxAmount;
            taxDetails = tax;
        }
        const totalAmount = subtotal - discountAmount + shippingCost + taxAmount;
        return { items: itemDetails, subtotal, discountAmount, promoDetails, shippingCost, shippingMethod, taxAmount, taxDetails, totalAmount };
    }
};
exports.CheckoutService = CheckoutService;
exports.CheckoutService = CheckoutService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], CheckoutService);
//# sourceMappingURL=checkout.service.js.map