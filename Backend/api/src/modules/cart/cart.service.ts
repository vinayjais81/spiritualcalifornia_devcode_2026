import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Get or create cart ────────────────────────────────────────────────────

  private async getOrCreateCart(userId?: string, sessionId?: string) {
    const where = userId ? { userId } : { sessionId };
    let cart = await this.prisma.cart.findFirst({ where });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId, sessionId },
      });
    }
    return cart;
  }

  // ─── Get cart with items + resolved details ────────────────────────────────

  async getCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
    });

    // Resolve item details for each cart item
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let details: any = null;
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
      }),
    );

    return { id: cart.id, items: enrichedItems, itemCount: items.length };
  }

  // ─── Add item ──────────────────────────────────────────────────────────────

  async addItem(dto: AddCartItemDto, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    // Upsert: if same item+variant already in cart, increment quantity
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

  // ─── Update item quantity ──────────────────────────────────────────────────

  async updateItem(itemId: string, dto: UpdateCartItemDto, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity, metadata: dto.metadata ?? undefined },
    });
  }

  // ─── Remove item ───────────────────────────────────────────────────────────

  async removeItem(itemId: string, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  // ─── Clear cart ────────────────────────────────────────────────────────────

  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { cleared: true };
  }

  // ─── Merge guest cart into user cart on login ──────────────────────────────

  async mergeGuestCart(userId: string, sessionId: string) {
    const guestCart = await this.prisma.cart.findFirst({ where: { sessionId } });
    if (!guestCart) return;

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
      } else {
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

    // Delete guest cart
    await this.prisma.cart.delete({ where: { id: guestCart.id } });
  }
}
