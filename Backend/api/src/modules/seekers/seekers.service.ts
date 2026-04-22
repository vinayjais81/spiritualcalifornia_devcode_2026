import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CartService } from '../cart/cart.service';

@Injectable()
export class SeekersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  // ─── Onboarding ────────────────────────────────────────────────────────────

  async getOnboardingStatus(userId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) return { step: 1, completed: false };
    return { step: profile.onboardingStep, completed: profile.onboardingCompleted };
  }

  async updateOnboardingStep(userId: string, step: number, completed = false) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Seeker profile not found');
    return this.prisma.seekerProfile.update({
      where: { userId },
      data: { onboardingStep: step, ...(completed ? { onboardingCompleted: true } : {}) },
    });
  }

  // ─── Dashboard Profile ─────────────────────────────────────────────────────

  async getMyProfile(userId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true, email: true, firstName: true, lastName: true,
            avatarUrl: true, phone: true, createdAt: true,
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Seeker profile not found');
    return profile;
  }

  async updateProfile(userId: string, dto: { bio?: string; location?: string; timezone?: string; interests?: string[] }) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Seeker profile not found');
    return this.prisma.seekerProfile.update({
      where: { userId },
      data: dto,
    });
  }

  // ─── Dashboard Stats ───────────────────────────────────────────────────────

  async getDashboardStats(userId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) return { totalBookings: 0, upcomingBookings: 0, completedBookings: 0, totalSpent: 0, favoriteGuides: 0 };

    const now = new Date();

    const [totalBookings, upcomingBookings, completedBookings, payments, favoriteGuides] = await Promise.all([
      this.prisma.booking.count({ where: { seekerId: profile.id } }),
      this.prisma.booking.count({
        where: {
          seekerId: profile.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          slot: { startTime: { gte: now } },
        },
      }),
      this.prisma.booking.count({ where: { seekerId: profile.id, status: 'COMPLETED' } }),
      this.prisma.payment.findMany({
        where: { booking: { seekerId: profile.id }, status: 'SUCCEEDED' },
        select: { amount: true },
      }),
      this.prisma.favorite.count({ where: { seekerId: profile.id } }),
    ]);

    const totalSpent = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return { totalBookings, upcomingBookings, completedBookings, totalSpent, favoriteGuides };
  }

  // ─── Pending Actions (checkout-resume aggregation) ────────────────────────
  // Surfaces everything the seeker left mid-flow so the dashboard can show
  // a single "Needs your attention" panel. Each bucket returns only rows
  // where the seeker can still act: not cancelled, not fully paid, holds
  // not expired. Ordered so the most time-sensitive rows sit at the top.
  async getPendingActions(userId: string, sessionId?: string) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    const seekerId = profile?.id;
    const now = new Date();

    // 1. Cart (products + events in cart). Hydrated by CartService so warnings
    //    (priceChanged, overstock) surface consistently with /cart.
    const cart = await this.cartService.getCart(userId, sessionId).catch(() => null);
    const cartBucket = cart && cart.items.length > 0
      ? {
          itemCount: cart.itemCount,
          subtotal: cart.items.reduce((s: number, i: any) => {
            const unit = Number(i.currentPrice ?? i.priceAtAdd ?? 0);
            return s + unit * (i.quantity ?? 1);
          }, 0),
          hasWarnings: cart.items.some((i: any) => i.priceChanged || i.overstock) || cart.removedItems.length > 0,
          thumbnails: cart.items
            .map((i: any) => i.details?.imageUrls?.[0] ?? i.details?.coverImageUrl ?? i.details?.event?.coverImageUrl)
            .filter(Boolean)
            .slice(0, 3),
        }
      : null;

    if (!seekerId) {
      // Guest user — only cart can apply. No tour/booking/ticket belongs to
      // an unknown seeker.
      return { cart: cartBucket, pendingTours: [], pendingBookings: [], pendingTickets: [] };
    }

    // 2. Soul tours with an active 24h hold (or older PENDING rows the user
    //    can still finish — deposit not yet paid).
    const pendingTourRows = await this.prisma.tourBooking.findMany({
      where: {
        seekerId,
        status: 'PENDING',
        OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gte: now } }],
      },
      include: {
        tour: { select: { title: true, coverImageUrl: true, slug: true } },
        departure: { select: { startDate: true, endDate: true } },
      },
      orderBy: [{ holdExpiresAt: 'asc' }, { createdAt: 'desc' }],
      take: 5,
    });

    const pendingTours = pendingTourRows.map((b) => {
      const holdMsLeft = b.holdExpiresAt ? b.holdExpiresAt.getTime() - now.getTime() : null;
      const holdHoursLeft = holdMsLeft != null ? Math.max(0, Math.floor(holdMsLeft / 3_600_000)) : null;
      const depositDue = Number(b.chosenDepositAmount ?? b.depositAmount ?? b.totalAmount);
      return {
        id: b.id,
        title: b.tour.title,
        coverImageUrl: b.tour.coverImageUrl,
        tourSlug: b.tour.slug,
        travelers: b.travelers,
        depositDue,
        totalAmount: Number(b.totalAmount),
        currency: b.currency,
        holdExpiresAt: b.holdExpiresAt,
        holdHoursLeft,
        departureStart: b.departure?.startDate ?? null,
      };
    });

    // 3. Service bookings awaiting payment. PENDING status means the seeker
    //    picked a slot but never completed checkout. Only show bookings whose
    //    slot is still in the future.
    const pendingBookingRows = await this.prisma.booking.findMany({
      where: {
        seekerId,
        status: 'PENDING',
        slot: { startTime: { gte: now } },
      },
      include: {
        service: {
          select: {
            name: true,
            durationMin: true,
            guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } },
          },
        },
        slot: { select: { startTime: true } },
      },
      orderBy: { slot: { startTime: 'asc' } },
      take: 5,
    });

    const pendingBookings = pendingBookingRows.map((b) => ({
      id: b.id,
      serviceName: b.service.name,
      guideName: b.service.guide.displayName,
      guideAvatar: b.service.guide.user?.avatarUrl ?? null,
      slotStart: b.slot.startTime,
      durationMin: b.service.durationMin,
      totalAmount: Number(b.totalAmount),
      currency: b.currency,
    }));

    // 4. Event ticket purchases stuck in PENDING. Rare — usually means payment
    //    failed mid-flow. Only show those whose event hasn't started yet.
    const pendingTicketRows = await this.prisma.ticketPurchase.findMany({
      where: {
        seekerId,
        status: 'PENDING',
        tier: { event: { startTime: { gte: now }, isCancelled: false } },
      },
      include: {
        tier: {
          select: {
            name: true,
            price: true,
            event: { select: { title: true, startTime: true, coverImageUrl: true, id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Collapse by purchaseGroupId so a multi-ticket checkout shows as one row
    const ticketGroups = new Map<string, {
      id: string;
      eventId: string;
      eventTitle: string;
      coverImageUrl: string | null;
      tierName: string;
      quantity: number;
      totalAmount: number;
      eventStart: Date;
    }>();
    for (const t of pendingTicketRows) {
      const key = t.purchaseGroupId;
      const existing = ticketGroups.get(key);
      if (existing) {
        existing.quantity += t.quantity;
        existing.totalAmount += Number(t.totalAmount) + Number(t.bookingFee);
      } else {
        ticketGroups.set(key, {
          id: t.purchaseGroupId,
          eventId: t.tier.event.id,
          eventTitle: t.tier.event.title,
          coverImageUrl: t.tier.event.coverImageUrl,
          tierName: t.tier.name,
          quantity: t.quantity,
          totalAmount: Number(t.totalAmount) + Number(t.bookingFee),
          eventStart: t.tier.event.startTime,
        });
      }
    }
    const pendingTickets = Array.from(ticketGroups.values());

    return { cart: cartBucket, pendingTours, pendingBookings, pendingTickets };
  }

  // ─── Payment History ───────────────────────────────────────────────────────

  async getPaymentHistory(userId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) return [];

    return this.prisma.payment.findMany({
      where: {
        OR: [
          { booking: { seekerId: profile.id } },
          { order: { seekerId: profile.id } },
          { ticketPurchase: { seekerId: profile.id } },
          { tourBooking: { seekerId: profile.id } },
        ],
      },
      include: {
        booking: {
          select: {
            id: true,
            service: { select: { name: true, guide: { select: { displayName: true } } } },
            slot: { select: { startTime: true } },
          },
        },
        order: { select: { id: true, items: { select: { product: { select: { name: true } } } } } },
        ticketPurchase: { select: { id: true, tier: { select: { name: true, event: { select: { title: true } } } } } },
        tourBooking: { select: { id: true, tour: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Favorites ─────────────────────────────────────────────────────────────

  async getFavorites(userId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) return [];

    return this.prisma.favorite.findMany({
      where: { seekerId: profile.id },
      include: {
        seeker: false as any,
      },
      orderBy: { createdAt: 'desc' },
    }).then(async (favs) => {
      // Fetch guide details for each favorite
      const guideIds = favs.map(f => f.guideId);
      const guides = await this.prisma.guideProfile.findMany({
        where: { id: { in: guideIds } },
        select: {
          id: true, slug: true, displayName: true, tagline: true,
          averageRating: true, totalReviews: true, isVerified: true,
          user: { select: { avatarUrl: true } },
        },
      });
      const guideMap = new Map(guides.map(g => [g.id, g]));
      return favs.map(f => ({ ...f, guide: guideMap.get(f.guideId) || null }));
    });
  }

  async addFavorite(userId: string, guideId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Seeker profile not found');

    const guide = await this.prisma.guideProfile.findUnique({ where: { id: guideId } });
    if (!guide) throw new NotFoundException('Guide not found');

    const existing = await this.prisma.favorite.findUnique({
      where: { seekerId_guideId: { seekerId: profile.id, guideId } },
    });
    if (existing) throw new ConflictException('Already in favorites');

    return this.prisma.favorite.create({
      data: { seekerId: profile.id, guideId },
    });
  }

  async removeFavorite(userId: string, guideId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Seeker profile not found');

    await this.prisma.favorite.deleteMany({
      where: { seekerId: profile.id, guideId },
    });
    return { deleted: true };
  }
}
