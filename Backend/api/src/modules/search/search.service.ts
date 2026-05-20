import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AlgoliaService, GuideSearchRecord, ProductSearchRecord, EventSearchRecord } from './algolia.service';
import { PostgresSearchService } from './postgres-search.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly algolia: AlgoliaService,
    private readonly pg: PostgresSearchService,
  ) {}

  // ─── Search Endpoints ──────────────────────────────────────────────────────
  //
  // 2026-05-20: Search now runs on Postgres FTS. Algolia is dormant via
  // ALGOLIA_ENABLED=false (its service no-ops). The reindex/index/remove
  // helpers below still exist so flipping the flag back on doesn't
  // require code surgery. Listing-page visibility gates are enforced
  // inside PostgresSearchService — same gates as /practitioners, /shop,
  // /events, /travels, /journal — so search can't surface a row the
  // listing would hide.

  async searchAll(query: string) {
    return this.pg.searchAll(query);
  }

  async searchGuides(query: string, _filters?: string, page = 0) {
    // _filters reserved — Algolia's filter DSL doesn't translate 1:1 to
    // Postgres FTS. When/if facet filtering is needed, add structured
    // filter params (modality, location, etc.) here.
    return this.pg.searchGuides(query, page);
  }

  async searchProducts(query: string, _filters?: string, page = 0) {
    return this.pg.searchProducts(query, page);
  }

  async searchEvents(query: string, _filters?: string, page = 0) {
    return this.pg.searchEvents(query, page);
  }

  async searchTours(query: string, page = 0) {
    return this.pg.searchTours(query, page);
  }

  async searchBlog(query: string, page = 0) {
    return this.pg.searchBlog(query, page);
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
    // Skip guides whose User account is deactivated — their public profile
    // 404s, so indexing them would surface dead links in search results.
    const guides = await this.prisma.guideProfile.findMany({
      where: { isPublished: true, user: { isActive: true } },
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
      where: { isActive: true, guide: { user: { isActive: true } } },
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
      where: { isPublished: true, isCancelled: false, guide: { user: { isActive: true } } },
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
        user: { select: { avatarUrl: true, isActive: true } },
        categories: { include: { category: true } },
        services: { where: { isActive: true }, select: { price: true, type: true, durationMin: true } },
      },
    });
    if (!guide || !guide.isPublished || !guide.user.isActive) return;

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

  // ─── Per-guide cascade helpers (called by admin deactivate/activate) ─────
  //
  // When an admin Deactivates a guide, the listing queries hide them
  // instantly via the user.isActive: true gate — but the Algolia indices
  // hold whatever was last indexed and will keep returning the guide +
  // their products + their events until a reindex runs. These helpers let
  // the admin path scrub the search index immediately so search results
  // stay consistent with the listings.

  async removeAllForGuide(guideId: string): Promise<{
    guideRemoved: boolean;
    productsRemoved: number;
    eventsRemoved: number;
  }> {
    const [productIds, eventIds] = await Promise.all([
      this.prisma.product.findMany({ where: { guideId }, select: { id: true } }),
      this.prisma.event.findMany({ where: { guideId }, select: { id: true } }),
    ]);

    await Promise.all([
      this.algolia.removeGuide(guideId),
      ...productIds.map((p) => this.algolia.removeProduct(p.id)),
      ...eventIds.map((e) => this.algolia.removeEvent(e.id)),
    ]);

    return {
      guideRemoved: true,
      productsRemoved: productIds.length,
      eventsRemoved: eventIds.length,
    };
  }

  async reindexAllForGuide(guideId: string): Promise<{
    guideIndexed: boolean;
    productsIndexed: number;
    eventsIndexed: number;
  }> {
    // Re-index the guide if they still satisfy the publish gate.
    await this.indexGuide(guideId);

    // Re-index the guide's currently-active products.
    const products = await this.prisma.product.findMany({
      where: { guideId, isActive: true },
      include: { guide: { select: { displayName: true, slug: true } } },
    });
    const productRecords: ProductSearchRecord[] = products.map((p) => ({
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
    await this.algolia.bulkIndexProducts(productRecords);

    // Re-index the guide's currently-published events.
    const events = await this.prisma.event.findMany({
      where: { guideId, isPublished: true, isCancelled: false },
      include: {
        guide: { select: { displayName: true, slug: true } },
        ticketTiers: { where: { isActive: true } },
      },
    });
    const eventRecords: EventSearchRecord[] = events.map((e) => {
      const prices = e.ticketTiers.map((t) => Number(t.price));
      const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
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
    await this.algolia.bulkIndexEvents(eventRecords);

    return {
      guideIndexed: true,
      productsIndexed: productRecords.length,
      eventsIndexed: eventRecords.length,
    };
  }

  async indexProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { guide: { select: { displayName: true, slug: true, user: { select: { isActive: true } } } } },
    });
    if (!product || !product.isActive || !product.guide.user.isActive) return;

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
