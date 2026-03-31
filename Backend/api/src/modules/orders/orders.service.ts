import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutService } from '../checkout/checkout.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly checkoutService: CheckoutService,
  ) {}

  // ─── Create Order ──────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateOrderDto) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    // Resolve products and calculate prices
    const itemDetails = await Promise.all(
      dto.items.map(async (item) => {
        const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
        if (!product || !product.isActive) throw new NotFoundException(`Product ${item.productId} not found`);

        let unitPrice = Number(product.price);

        if (item.variantId) {
          const variant = await this.prisma.productVariant.findUnique({ where: { id: item.variantId } });
          if (!variant || variant.productId !== product.id) throw new BadRequestException('Invalid variant');
          if (variant.stockQuantity < item.quantity) throw new BadRequestException(`Insufficient stock for ${variant.name}`);
          if (variant.price) unitPrice = Number(variant.price);
        } else if (product.type === 'PHYSICAL' && product.stockQuantity !== null && product.stockQuantity < item.quantity) {
          throw new BadRequestException(`Insufficient stock for ${product.name}`);
        }

        return { product, unitPrice, quantity: item.quantity, variantId: item.variantId };
      }),
    );

    const subtotal = itemDetails.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const hasPhysical = itemDetails.some((i) => i.product.type === 'PHYSICAL');

    // Shipping
    let shippingCost = 0;
    if (hasPhysical && dto.shippingMethodId) {
      const method = await this.checkoutService.getShippingMethod(dto.shippingMethodId);
      shippingCost = Number(method.price);
    }

    // Promo code
    let discountAmount = 0;
    let promoCodeId: string | undefined;
    if (dto.promoCode) {
      const promo = await this.checkoutService.validatePromoCode(dto.promoCode, subtotal);
      discountAmount = promo.discountAmount;
      promoCodeId = promo.promoCodeId;
    }

    // Tax
    const state = dto.shippingAddress?.state;
    let taxRate = 0;
    let taxAmount = 0;
    if (hasPhysical && state) {
      const tax = await this.checkoutService.calculateTax(state, subtotal - discountAmount);
      taxRate = tax.rate;
      taxAmount = tax.taxAmount;
    }

    const totalAmount = subtotal - discountAmount + shippingCost + taxAmount;

    // Create order in transaction
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
          shippingAddress: dto.shippingAddress ? (dto.shippingAddress as any) : undefined,
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

      // Increment promo code usage
      if (promoCodeId) {
        await tx.promoCode.update({ where: { id: promoCodeId }, data: { usedCount: { increment: 1 } } });
      }

      return newOrder;
    });

    // Create payment intent
    const paymentIntent = await this.paymentsService.createPaymentIntent({
      amount: totalAmount,
      orderId: order.id,
    });

    return { order, paymentIntent };
  }

  // ─── List Seeker's Orders ──────────────────────────────────────────────────

  async findMyOrders(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) return [];
    return this.prisma.order.findMany({
      where: { seekerId: seeker.id },
      include: {
        items: { include: { product: { select: { name: true, type: true, imageUrls: true } } } },
        payment: { select: { status: true, paymentMethod: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Get Single Order ──────────────────────────────────────────────────────

  async findOne(userId: string, orderId: string) {
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
    if (!order) throw new NotFoundException('Order not found');
    if (seeker && order.seekerId !== seeker.id) throw new ForbiddenException('Access denied');
    return order;
  }
}
