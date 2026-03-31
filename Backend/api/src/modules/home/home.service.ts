import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getHomePageData() {
    // Cache home page data for 5 minutes
    return this.cache.getOrSet(CacheService.keys.homeData(), () => this._fetchHomeData(), 300);
  }

  private async _fetchHomeData() {
    const [
      featuredGuides,
      recentBlogPosts,
      activeProducts,
      upcomingEvents,
      soulTravelEvents,
    ] = await Promise.all([
      this.getFeaturedGuides(),
      this.getRecentBlogPosts(),
      this.getActiveProducts(),
      this.getUpcomingEvents(),
      this.getSoulTravelEvents(),
    ]);

    return {
      featuredGuides,
      recentBlogPosts,
      activeProducts,
      upcomingEvents,
      soulTravelEvents,
    };
  }

  // ─── Featured Guides (verified, published, with best ratings) ──────────────

  private async getFeaturedGuides() {
    const guides = await this.prisma.guideProfile.findMany({
      where: { isPublished: true, isVerified: true },
      orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
      take: 10,
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        categories: {
          include: {
            category: { select: { name: true, slug: true } },
            subcategory: { select: { name: true } },
          },
          take: 3,
        },
      },
    });

    return guides.map((g) => ({
      id: g.id,
      slug: g.slug,
      displayName: g.displayName,
      tagline: g.tagline,
      location: g.location,
      avatarUrl: g.user.avatarUrl,
      isVerified: g.isVerified,
      averageRating: g.averageRating,
      totalReviews: g.totalReviews,
      specialties: g.categories.map(c => c.subcategory?.name || c.category.name).slice(0, 3),
    }));
  }

  // ─── Recent Blog Posts (published, with cover images preferred) ────────────

  private async getRecentBlogPosts() {
    const posts = await this.prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      take: 8,
      include: {
        guide: {
          select: {
            slug: true,
            displayName: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });

    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      coverImageUrl: p.coverImageUrl,
      tags: p.tags,
      publishedAt: p.publishedAt,
      guide: {
        slug: p.guide.slug,
        displayName: p.guide.displayName,
        avatarUrl: p.guide.user.avatarUrl,
      },
    }));
  }

  // ─── Active Products (with images, mix of digital + physical) ──────────────

  private async getActiveProducts() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        guide: {
          select: {
            slug: true,
            displayName: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      price: p.price,
      imageUrls: p.imageUrls,
      guide: {
        slug: p.guide.slug,
        displayName: p.guide.displayName,
        avatarUrl: p.guide.user.avatarUrl,
      },
    }));
  }

  // ─── Upcoming Events (published, not cancelled, future dates) ──────────────

  private async getUpcomingEvents() {
    const events = await this.prisma.event.findMany({
      where: {
        isPublished: true,
        isCancelled: false,
        startTime: { gte: new Date() },
        type: { not: 'SOUL_TRAVEL' },
      },
      orderBy: { startTime: 'asc' },
      take: 8,
      include: {
        ticketTiers: { take: 1, orderBy: { price: 'asc' } },
        guide: {
          select: {
            slug: true,
            displayName: true,
            location: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location,
      coverImageUrl: e.coverImageUrl,
      startingPrice: e.ticketTiers[0]?.price || 0,
      spotsLeft: e.ticketTiers[0] ? e.ticketTiers[0].capacity - e.ticketTiers[0].sold : null,
      guide: {
        slug: e.guide.slug,
        displayName: e.guide.displayName,
        avatarUrl: e.guide.user.avatarUrl,
      },
    }));
  }

  // ─── Soul Travel Events (retreats, nature experiences) ─────────────────────

  private async getSoulTravelEvents() {
    const events = await this.prisma.event.findMany({
      where: {
        isPublished: true,
        isCancelled: false,
        type: 'SOUL_TRAVEL',
      },
      orderBy: { startTime: 'asc' },
      take: 6,
      include: {
        ticketTiers: { take: 1, orderBy: { price: 'asc' } },
        guide: {
          select: {
            slug: true,
            displayName: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location,
      coverImageUrl: e.coverImageUrl,
      startingPrice: e.ticketTiers[0]?.price || 0,
      guide: {
        slug: e.guide.slug,
        displayName: e.guide.displayName,
        avatarUrl: e.guide.user.avatarUrl,
      },
    }));
  }
}
