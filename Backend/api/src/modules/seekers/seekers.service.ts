import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SeekersService {
  constructor(private readonly prisma: PrismaService) {}

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
