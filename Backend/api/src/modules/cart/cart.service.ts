import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

/** Guest cart TTL — sweep any guest cart idle longer than this on load. */
const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * A hydrated cart item returned to the frontend. Carries enough state that
 * the UI can render item details, detect price changes, clamp against stock,
 * and show removal warnings — without any extra round-trips.
 */
export interface HydratedCartItem {
  id: string;
  itemType: string;
  itemId: string;
  variantId: string | null;
  quantity: number;
  priceAtAdd: number | null;
  currentPrice: number | null;
  metadata: any;
  /** Fully-resolved product/event/tour/service record. Null if it vanished. */
  details: any;
  /** Non-null price snapshot differs from currentPrice by more than 1 cent. */
  priceChanged: boolean;
  /** cart.quantity exceeds stockQuantity on the current product/variant. */
  overstock: boolean;
  /** Best-effort current stock for PRODUCT / PRODUCT+variant / EVENT_TICKET / SOUL_TOUR. null = unlimited/unknown. */
  availableStock: number | null;
}

export interface CartResponse {
  id: string;
  items: HydratedCartItem[];
  itemCount: number;
  /** Items that were dropped on load (deactivated, deleted, or stock exhausted). */
  removedItems: Array<{ name: string; reason: 'unavailable' | 'deleted' | 'sold_out' }>;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Lazy TTL sweep ────────────────────────────────────────────────────────
  // Cheap enough to run on any cart load. Anonymous users get a fresh empty
  // cart if their previous guest cart has gone cold; signed-in users never
  // expire.
  private async sweepExpiredGuestCarts() {
    const cutoff = new Date(Date.now() - GUEST_CART_TTL_MS);
    try {
      const result = await this.prisma.cart.deleteMany({
        where: { userId: null, updatedAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.debug(`TTL sweep removed ${result.count} stale guest carts`);
      }
    } catch (err: any) {
      // Never fail a cart request because housekeeping hiccupped.
      this.logger.warn(`Guest cart sweep failed: ${err?.message}`);
    }
  }

  // ─── Get or create cart ────────────────────────────────────────────────────
  private async getOrCreateCart(userId?: string, sessionId?: string) {
    await this.sweepExpiredGuestCarts();

    const where = userId ? { userId } : sessionId ? { sessionId } : null;
    if (!where) {
      // No user and no sessionId — create an anonymous cart anyway using the
      // sessionId as-provided (which could be undefined, then Prisma errors).
      // This path shouldn't happen in practice; guard with a clear error.
      throw new Error('Cart requires either an authenticated user or a sessionId');
    }

    let cart = await this.prisma.cart.findFirst({ where });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId: userId ?? null, sessionId: userId ? null : sessionId ?? null },
      });
    }
    return cart;
  }

  /** Poke Cart.updatedAt so TTL + "last active" are accurate. */
  private async touchCart(cartId: string) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    }).catch(() => { /* row may have been deleted concurrently; safe to ignore */ });
  }

  // ─── Get cart with hydrated items + warnings ───────────────────────────────
  async getCart(userId?: string, sessionId?: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
    });

    const hydrated: HydratedCartItem[] = [];
    const removedItems: CartResponse['removedItems'] = [];

    for (const item of items) {
      const snapshot = await this.hydrateItem(item);
      if (!snapshot) continue; // already purged
      if (snapshot.removeReason) {
        removedItems.push({ name: snapshot.removedName || 'Item', reason: snapshot.removeReason });
        await this.prisma.cartItem.delete({ where: { id: item.id } }).catch(() => {});
        continue;
      }
      hydrated.push(snapshot.item);
    }

    return {
      id: cart.id,
      items: hydrated,
      itemCount: hydrated.reduce((s, i) => s + i.quantity, 0),
      removedItems,
    };
  }

  /**
   * Resolve a cart row into either a HydratedCartItem or a removal verdict.
   * Returning null means "already purged by concurrent request — treat as gone".
   */
  private async hydrateItem(item: {
    id: string;
    cartId: string;
    itemType: string;
    itemId: string;
    variantId: string | null;
    quantity: number;
    priceAtAdd: any; // Prisma Decimal | null
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<
    | { item: HydratedCartItem; removeReason?: never; removedName?: never }
    | { item?: never; removeReason: 'unavailable' | 'deleted' | 'sold_out'; removedName: string }
    | null
  > {
    let details: any = null;
    let currentPrice: number | null = null;
    let availableStock: number | null = null;
    let displayName = 'Item';

    switch (item.itemType) {
      case 'PRODUCT': {
        const product = await this.prisma.product.findUnique({
          where: { id: item.itemId },
          select: {
            id: true, name: true, type: true, price: true, currency: true,
            imageUrls: true, stockQuantity: true, isActive: true,
            guide: { select: { displayName: true, slug: true } },
          },
        });
        if (!product) return { removeReason: 'deleted', removedName: 'Product' };
        displayName = product.name;
        if (!product.isActive) return { removeReason: 'unavailable', removedName: product.name };

        currentPrice = Number(product.price);
        availableStock = product.stockQuantity;
        details = product;

        if (item.variantId) {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: item.variantId },
            select: { id: true, name: true, price: true, stockQuantity: true, isActive: true, attributes: true },
          });
          if (!variant || !variant.isActive) return { removeReason: 'unavailable', removedName: product.name };
          if (variant.price != null) currentPrice = Number(variant.price);
          availableStock = variant.stockQuantity;
          details = { ...product, selectedVariant: variant };
        }

        if (product.type === 'PHYSICAL' && availableStock !== null && availableStock <= 0) {
          return { removeReason: 'sold_out', removedName: product.name };
        }
        break;
      }
      case 'EVENT_TICKET': {
        const tier = await this.prisma.eventTicketTier.findUnique({
          where: { id: item.itemId },
          select: {
            id: true, name: true, price: true, currency: true, capacity: true, sold: true, isActive: true,
            event: { select: { id: true, title: true, startTime: true, endTime: true, location: true, coverImageUrl: true, isCancelled: true, isPublished: true } },
          },
        });
        if (!tier) return { removeReason: 'deleted', removedName: 'Event ticket' };
        displayName = tier.event?.title ?? 'Event ticket';
        if (!tier.isActive || tier.event?.isCancelled || !tier.event?.isPublished) {
          return { removeReason: 'unavailable', removedName: displayName };
        }
        if (tier.event.startTime && new Date(tier.event.startTime) < new Date()) {
          return { removeReason: 'unavailable', removedName: displayName };
        }

        currentPrice = Number(tier.price);
        availableStock = Math.max(0, tier.capacity - tier.sold);
        details = tier;
        if (availableStock <= 0) return { removeReason: 'sold_out', removedName: displayName };
        break;
      }
      case 'SOUL_TOUR': {
        const tour = await this.prisma.soulTour.findUnique({
          where: { id: item.itemId },
          select: {
            id: true, title: true, slug: true, basePrice: true, currency: true, startDate: true,
            endDate: true, location: true, coverImageUrl: true, spotsRemaining: true,
            isPublished: true, isCancelled: true,
          },
        });
        if (!tour) return { removeReason: 'deleted', removedName: 'Soul tour' };
        displayName = tour.title;
        if (!tour.isPublished || tour.isCancelled) return { removeReason: 'unavailable', removedName: tour.title };

        currentPrice = Number(tour.basePrice);
        availableStock = tour.spotsRemaining;
        details = tour;
        if (availableStock <= 0) return { removeReason: 'sold_out', removedName: tour.title };
        break;
      }
      case 'SERVICE_BOOKING': {
        const service = await this.prisma.service.findUnique({
          where: { id: item.itemId },
          select: {
            id: true, name: true, type: true, price: true, currency: true, durationMin: true, isActive: true,
            guide: { select: { displayName: true, slug: true } },
          },
        });
        if (!service) return { removeReason: 'deleted', removedName: 'Service' };
        displayName = service.name;
        if (!service.isActive) return { removeReason: 'unavailable', removedName: service.name };

        currentPrice = Number(service.price);
        availableStock = null; // service slots are time-based; handled in booking flow
        details = service;
        break;
      }
      default:
        return { removeReason: 'unavailable', removedName: 'Unknown item' };
    }

    // Price-change detection. Use 1 cent tolerance so floating-point noise
    // from Decimal conversions doesn't fire false positives.
    const snapshotPrice = item.priceAtAdd != null ? Number(item.priceAtAdd) : null;
    const priceChanged =
      snapshotPrice != null && currentPrice != null &&
      Math.abs(snapshotPrice - currentPrice) > 0.01;

    const overstock = availableStock !== null && item.quantity > availableStock;

    return {
      item: {
        id: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        variantId: item.variantId,
        quantity: item.quantity,
        priceAtAdd: snapshotPrice,
        currentPrice,
        metadata: item.metadata,
        details,
        priceChanged,
        overstock,
        availableStock,
      },
    };
  }

  // ─── Add item ──────────────────────────────────────────────────────────────
  async addItem(dto: AddCartItemDto, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    // Snapshot the current unit price so we can detect later changes.
    const priceAtAdd = await this.resolveUnitPrice(dto.itemType, dto.itemId, dto.variantId);

    const existing = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        itemType: dto.itemType,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
      },
    });

    const result = existing
      ? await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + (dto.quantity ?? 1),
            // Re-snapshot price on re-add so the stored price reflects the most
            // recent "intent to buy at this price" signal.
            priceAtAdd: priceAtAdd ?? existing.priceAtAdd,
          },
        })
      : await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            itemType: dto.itemType,
            itemId: dto.itemId,
            variantId: dto.variantId,
            quantity: dto.quantity ?? 1,
            priceAtAdd,
            metadata: dto.metadata ?? undefined,
          },
        });

    await this.touchCart(cart.id);
    return result;
  }

  /** Resolve the unit price for an item at the moment it's added. */
  private async resolveUnitPrice(
    itemType: string,
    itemId: string,
    variantId?: string | null,
  ): Promise<number | null> {
    switch (itemType) {
      case 'PRODUCT': {
        if (variantId) {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: variantId },
            select: { price: true, product: { select: { price: true } } },
          });
          if (!variant) return null;
          return Number(variant.price ?? variant.product.price);
        }
        const product = await this.prisma.product.findUnique({
          where: { id: itemId }, select: { price: true },
        });
        return product ? Number(product.price) : null;
      }
      case 'EVENT_TICKET': {
        const tier = await this.prisma.eventTicketTier.findUnique({
          where: { id: itemId }, select: { price: true },
        });
        return tier ? Number(tier.price) : null;
      }
      case 'SOUL_TOUR': {
        const tour = await this.prisma.soulTour.findUnique({
          where: { id: itemId }, select: { basePrice: true },
        });
        return tour ? Number(tour.basePrice) : null;
      }
      case 'SERVICE_BOOKING': {
        const service = await this.prisma.service.findUnique({
          where: { id: itemId }, select: { price: true },
        });
        return service ? Number(service.price) : null;
      }
      default:
        return null;
    }
  }

  // ─── Update item quantity ──────────────────────────────────────────────────
  async updateItem(itemId: string, dto: UpdateCartItemDto, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    const result = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity, metadata: dto.metadata ?? undefined },
    });
    await this.touchCart(cart.id);
    return result;
  }

  // ─── Remove item ───────────────────────────────────────────────────────────
  async removeItem(itemId: string, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    await this.touchCart(cart.id);
    return { deleted: true };
  }

  // ─── Clear cart ────────────────────────────────────────────────────────────
  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.touchCart(cart.id);
    return { cleared: true };
  }

  // ─── Merge guest cart into user cart on login ──────────────────────────────
  // Called by the frontend right after login. Idempotent: no-op if the guest
  // session has no cart. If the user already has items, we union (summing
  // quantities on matching item+variant pairs) — matches Amazon/Shopify.
  async mergeGuestCart(userId: string, sessionId: string) {
    if (!sessionId) return { merged: 0 };
    const guestCart = await this.prisma.cart.findFirst({ where: { sessionId } });
    if (!guestCart) return { merged: 0 };

    const userCart = await this.getOrCreateCart(userId);
    const guestItems = await this.prisma.cartItem.findMany({ where: { cartId: guestCart.id } });

    let mergedCount = 0;
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
            priceAtAdd: item.priceAtAdd,
            metadata: item.metadata ?? undefined,
          },
        });
      }
      mergedCount++;
    }

    // Delete guest cart (cascades to its items)
    await this.prisma.cart.delete({ where: { id: guestCart.id } });
    await this.touchCart(userCart.id);
    return { merged: mergedCount };
  }
}
