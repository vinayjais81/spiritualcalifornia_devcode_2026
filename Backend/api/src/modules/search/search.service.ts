import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AlgoliaService, GuideSearchRecord, ProductSearchRecord, EventSearchRecord } from './algolia.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly algolia: AlgoliaService,
  ) {}

  // ─── Search Endpoints ──────────────────────────────────────────────────────

  async searchAll(query: string) {
    return this.algolia.searchAll(query);
  }

  async searchGuides(query: string, filters?: string, page = 0) {
    return this.algolia.searchGuides(query, filters, page);
  }

  async searchProducts(query: string, filters?: string, page = 0) {
    return this.algolia.searchProducts(query, filters, page);
  }

  async searchEvents(query: string, filters?: string, page = 0) {
    return this.algolia.searchEvents(query, filters, page);
  }

  // ─── Bulk Index All Data (called from seed or admin) ───────────────────────

  async reindexAll() {
    const [guidesCount, productsCount, eventsCount] = await Promise.all([
      this.reindexGuides(),
      this.reindexProducts(),
      this.reindexEvents(),
    ]);
    return { guidesCount, productsCount, eventsCount };
  }

  async reindexGuides(): Promise<number> {
    const guides = await this.prisma.guideProfile.findMany({
      where: { isPublished: true },
      include: {
        user: { select: { avatarUrl: true } },
        categories: { include: { category: true, subcategory: true } },
        services: { where: { isActive: true }, select: { price: true, type: true, durationMin: true } },
      },
    });

    const records: GuideSearchRecord[] = guides.map((g) => {
      const session60 = g.services.find((s) => s.durationMin === 60);
      return {
        objectID: g.id,
        displayName: g.displayName,
        tagline: g.tagline ?? undefined,
        bio: g.bio ?? undefined,
        slug: g.slug,
        location: g.location ?? undefined,
        city: g.city ?? undefined,
        state: g.state ?? undefined,
        categories: [...new Set(g.categories.map((c) => c.category.name))],
        modalities: g.modalities,
        issuesHelped: g.issuesHelped,
        languages: g.languages,
        averageRating: g.averageRating,
        totalReviews: g.totalReviews,
        yearsExperience: g.yearsExperience ?? undefined,
        isVerified: g.isVerified,
        avatarUrl: g.user.avatarUrl ?? undefined,
        sessionPrice60: session60 ? Number(session60.price) : undefined,
        serviceTypes: [...new Set(g.services.map((s) => s.type))],
      };
    });

    await this.algolia.bulkIndexGuides(records);
    return records.length;
  }

  async reindexProducts(): Promise<number> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { guide: { select: { displayName: true, slug: true } } },
    });

    const records: ProductSearchRecord[] = products.map((p) => ({
      objectID: p.id,
      name: p.name,
      description: p.description ?? undefined,
      type: p.type,
      price: Number(p.price),
      guideName: p.guide.displayName,
      guideSlug: p.guide.slug,
      imageUrl: p.imageUrls?.[0] ?? undefined,
      tags: [],
    }));

    await this.algolia.bulkIndexProducts(records);
    return records.length;
  }

  async reindexEvents(): Promise<number> {
    const events = await this.prisma.event.findMany({
      where: { isPublished: true, isCancelled: false },
      include: {
        guide: { select: { displayName: true, slug: true } },
        ticketTiers: { where: { isActive: true } },
      },
    });

    const records: EventSearchRecord[] = events.map((e) => {
      const lowestPrice = Math.min(...e.ticketTiers.map((t) => Number(t.price)));
      const spotsLeft = e.ticketTiers.reduce((sum, t) => sum + t.capacity - t.sold, 0);
      return {
        objectID: e.id,
        title: e.title,
        type: e.type,
        startTime: Math.floor(e.startTime.getTime() / 1000),
        location: e.location ?? undefined,
        guideName: e.guide.displayName,
        guideSlug: e.guide.slug,
        price: lowestPrice,
        spotsLeft,
        imageUrl: e.coverImageUrl ?? undefined,
      };
    });

    await this.algolia.bulkIndexEvents(records);
    return records.length;
  }

  // ─── Single-record Index Helpers (called by other services) ────────────────

  async indexGuide(guideId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: guideId },
      include: {
        user: { select: { avatarUrl: true } },
        categories: { include: { category: true } },
        services: { where: { isActive: true }, select: { price: true, type: true, durationMin: true } },
      },
    });
    if (!guide || !guide.isPublished) return;

    const session60 = guide.services.find((s) => s.durationMin === 60);
    await this.algolia.indexGuide({
      objectID: guide.id,
      displayName: guide.displayName,
      tagline: guide.tagline ?? undefined,
      bio: guide.bio ?? undefined,
      slug: guide.slug,
      location: guide.location ?? undefined,
      city: guide.city ?? undefined,
      state: guide.state ?? undefined,
      categories: [...new Set(guide.categories.map((c) => c.category.name))],
      modalities: guide.modalities,
      issuesHelped: guide.issuesHelped,
      languages: guide.languages,
      averageRating: guide.averageRating,
      totalReviews: guide.totalReviews,
      yearsExperience: guide.yearsExperience ?? undefined,
      isVerified: guide.isVerified,
      avatarUrl: guide.user.avatarUrl ?? undefined,
      sessionPrice60: session60 ? Number(session60.price) : undefined,
      serviceTypes: [...new Set(guide.services.map((s) => s.type))],
    });
  }

  async indexProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { guide: { select: { displayName: true, slug: true } } },
    });
    if (!product || !product.isActive) return;

    await this.algolia.indexProduct({
      objectID: product.id,
      name: product.name,
      description: product.description ?? undefined,
      type: product.type,
      price: Number(product.price),
      guideName: product.guide.displayName,
      guideSlug: product.guide.slug,
      imageUrl: product.imageUrls?.[0] ?? undefined,
      tags: [],
    });
  }
}
