import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ─── Shipping Methods ──────────────────────────────────────────────────────

  async getShippingMethods() {
    return this.cache.getOrSet(CacheService.keys.shippingMethods(), () =>
      this.prisma.shippingMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    3600); // 1 hour cache
  }

  async getShippingMethod(id: string) {
    const method = await this.prisma.shippingMethod.findUnique({ where: { id } });
    if (!method || !method.isActive) throw new NotFoundException('Shipping method not found');
    return method;
  }

  // ─── Tax Calculation ───────────────────────────────────────────────────────

  async calculateTax(state: string, taxableAmount: number) {
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

  // ─── Promo Code Validation ─────────────────────────────────────────────────

  async validatePromoCode(code: string, subtotal: number) {
    const promo = await this.prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });

    if (!promo) throw new NotFoundException('Promo code not found');
    if (!promo.isActive) throw new BadRequestException('Promo code is inactive');
    if (promo.expiresAt && promo.expiresAt < new Date()) throw new BadRequestException('Promo code has expired');
    if (promo.startsAt && promo.startsAt > new Date()) throw new BadRequestException('Promo code is not yet active');
    if (promo.maxUses && promo.usedCount >= promo.maxUses) throw new BadRequestException('Promo code usage limit reached');
    if (promo.minOrderAmount && subtotal < Number(promo.minOrderAmount)) {
      throw new BadRequestException(`Minimum order amount is $${promo.minOrderAmount}`);
    }

    let discountAmount: number;
    if (promo.type === 'PERCENTAGE') {
      discountAmount = Math.round(subtotal * (Number(promo.amount) / 100) * 100) / 100;
      if (promo.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, Number(promo.maxDiscountAmount));
      }
    } else {
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

  // ─── Order Summary Preview (before placing order) ──────────────────────────

  async calculateOrderSummary(data: {
    items: Array<{ productId: string; variantId?: string; quantity: number }>;
    shippingMethodId?: string;
    promoCode?: string;
    state?: string;
  }) {
    // Calculate subtotal
    let subtotal = 0;
    const itemDetails = await Promise.all(
      data.items.map(async (item) => {
        const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
        let unitPrice = Number(product.price);
        if (item.variantId) {
          const variant = await this.prisma.productVariant.findUnique({ where: { id: item.variantId } });
          if (variant?.price) unitPrice = Number(variant.price);
        }
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;
        return { name: product.name, type: product.type, unitPrice, quantity: item.quantity, lineTotal };
      }),
    );

    const hasPhysical = itemDetails.some((i) => i.type === 'PHYSICAL');

    // Shipping
    let shippingCost = 0;
    let shippingMethod: { name: string; estimatedDaysMin: number; estimatedDaysMax: number } | null = null;
    if (hasPhysical && data.shippingMethodId) {
      const method = await this.getShippingMethod(data.shippingMethodId);
      shippingCost = Number(method.price);
      shippingMethod = { name: method.name, estimatedDaysMin: method.estimatedDaysMin, estimatedDaysMax: method.estimatedDaysMax };
    }

    // Discount
    let discountAmount = 0;
    let promoDetails: { promoCodeId: string; code: string; type: string; discountAmount: number; description: string } | null = null;
    if (data.promoCode) {
      try {
        const promo = await this.validatePromoCode(data.promoCode, subtotal);
        discountAmount = promo.discountAmount;
        promoDetails = promo;
      } catch {
        // Invalid promo — skip
      }
    }

    // Tax
    let taxAmount = 0;
    let taxDetails: { rate: number; taxAmount: number; name: string } | null = null;
    if (hasPhysical && data.state) {
      const tax = await this.calculateTax(data.state, subtotal - discountAmount);
      taxAmount = tax.taxAmount;
      taxDetails = tax;
    }

    const totalAmount = subtotal - discountAmount + shippingCost + taxAmount;

    return { items: itemDetails, subtotal, discountAmount, promoDetails, shippingCost, shippingMethod, taxAmount, taxDetails, totalAmount };
  }
}
