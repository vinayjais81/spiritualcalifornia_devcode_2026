import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Postgres-backed full-text search with trigram typo tolerance. Replaces
 * the Algolia-served endpoints while Algolia stays dormant
 * (ALGOLIA_ENABLED=false).
 *
 * Each entity's `searchVector tsvector` is maintained by a BEFORE INSERT/
 * UPDATE trigger that rebuilds it from the row's text fields — see
 * migration 20260520120000_postgres_fts.
 *
 * Hybrid matching (since 20260520150000_postgres_fts_trgm):
 *   1. websearch_to_tsquery against searchVector — exact-token matching,
 *      stemming-aware, fast via GIN tsvector index.
 *   2. pg_trgm similarity() against short identifier fields (names,
 *      titles) — best when the query covers the whole string.
 *   3. pg_trgm word_similarity(query, field) against longer fields
 *      (tagline, shortDesc) — finds the best matching substring, so a
 *      typo'd query like "sound heling" matches a 60-char tagline.
 *
 * The three signals are OR'd in WHERE and GREATEST'd in ORDER BY so a
 * row matching any way surfaces, ranked by the strongest signal.
 *
 * Thresholds (tuned for ~1-2 char typos in short queries):
 *   - SIMILARITY:      0.25 — pg_trgm default 0.3, lowered slightly
 *   - WORD_SIMILARITY: 0.5  — pg_trgm default 0.6, lowered slightly
 *
 * Public-visibility gates mirror the listing-page queries: each search
 * filters on the same isPublished/isActive/user.isActive conditions as
 * /practitioners, /shop, /events, /travels, /journal — so search can
 * never surface a row that the listing wouldn't.
 */
const SIMILARITY_THRESHOLD = 0.25;
const WORD_SIMILARITY_THRESHOLD = 0.5;
@Injectable()
export class PostgresSearchService {
  constructor(private readonly prisma: PrismaService) {}

  // Normalize empty/whitespace queries to null so calling sites can return
  // an empty result without hitting Postgres.
  private cleanQuery(q: string | undefined): string | null {
    if (!q) return null;
    const trimmed = q.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  // ─── Per-entity searches ───────────────────────────────────────────────────

  async searchGuides(query: string, page = 0, hitsPerPage = 20) {
    const q = this.cleanQuery(query);
    const skip = page * hitsPerPage;
    if (!q) {
      return { hits: [], nbHits: 0, page, hitsPerPage };
    }

    const hits = await this.prisma.$queryRaw<Array<{
      id: string; slug: string; displayName: string; tagline: string | null;
      bio: string | null; location: string | null; modalities: string[];
      averageRating: number; totalReviews: number; isVerified: boolean;
      avatarUrl: string | null; rank: number;
    }>>`
      SELECT
        g.id,
        g.slug,
        g."displayName",
        g.tagline,
        g.bio,
        g.location,
        g.modalities,
        g."averageRating",
        g."totalReviews",
        g."isVerified",
        u."avatarUrl",
        GREATEST(
          ts_rank_cd(g."searchVector", websearch_to_tsquery('english', ${q})),
          similarity(g."displayName", ${q}),
          word_similarity(${q}, coalesce(g.tagline, '')) * 0.85
        ) AS rank
      FROM guide_profiles g
      JOIN users u ON u.id = g."userId"
      WHERE g."isPublished" = true
        AND g."isVerified" = true
        AND u."isActive" = true
        AND (
          g."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(g."displayName", ${q}) > ${SIMILARITY_THRESHOLD}
          OR word_similarity(${q}, coalesce(g.tagline, '')) > ${WORD_SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC, g."averageRating" DESC, g."totalReviews" DESC
      LIMIT ${hitsPerPage} OFFSET ${skip}
    `;
    const [{ count }] = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM guide_profiles g
      JOIN users u ON u.id = g."userId"
      WHERE g."isPublished" = true
        AND g."isVerified" = true
        AND u."isActive" = true
        AND (
          g."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(g."displayName", ${q}) > ${SIMILARITY_THRESHOLD}
          OR word_similarity(${q}, coalesce(g.tagline, '')) > ${WORD_SIMILARITY_THRESHOLD}
        )
    `;
    return { hits, nbHits: Number(count), page, hitsPerPage };
  }

  async searchProducts(query: string, page = 0, hitsPerPage = 20) {
    const q = this.cleanQuery(query);
    const skip = page * hitsPerPage;
    if (!q) return { hits: [], nbHits: 0, page, hitsPerPage };

    const hits = await this.prisma.$queryRaw<Array<{
      id: string; name: string; description: string | null;
      type: string; category: string | null; price: string;
      imageUrl: string | null; guideName: string; guideSlug: string;
      rank: number;
    }>>`
      SELECT
        p.id,
        p.name,
        p.description,
        p.type::text AS type,
        p.category::text AS category,
        p.price::text AS price,
        (p."imageUrls")[1] AS "imageUrl",
        g."displayName" AS "guideName",
        g.slug AS "guideSlug",
        GREATEST(
          ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${q})),
          similarity(p.name, ${q})
        ) AS rank
      FROM products p
      JOIN guide_profiles g ON g.id = p."guideId"
      JOIN users u ON u.id = g."userId"
      WHERE p."isActive" = true
        AND u."isActive" = true
        AND (
          p."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(p.name, ${q}) > ${SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC, p."createdAt" DESC
      LIMIT ${hitsPerPage} OFFSET ${skip}
    `;
    const [{ count }] = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM products p
      JOIN guide_profiles g ON g.id = p."guideId"
      JOIN users u ON u.id = g."userId"
      WHERE p."isActive" = true
        AND u."isActive" = true
        AND (
          p."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(p.name, ${q}) > ${SIMILARITY_THRESHOLD}
        )
    `;
    return { hits, nbHits: Number(count), page, hitsPerPage };
  }

  async searchEvents(query: string, page = 0, hitsPerPage = 20) {
    const q = this.cleanQuery(query);
    const skip = page * hitsPerPage;
    if (!q) return { hits: [], nbHits: 0, page, hitsPerPage };

    const hits = await this.prisma.$queryRaw<Array<{
      id: string; title: string; type: string; startTime: Date;
      location: string | null; coverImageUrl: string | null;
      guideName: string; guideSlug: string; rank: number;
    }>>`
      SELECT
        e.id,
        e.title,
        e.type::text AS type,
        e."startTime",
        e.location,
        e."coverImageUrl",
        g."displayName" AS "guideName",
        g.slug AS "guideSlug",
        GREATEST(
          ts_rank_cd(e."searchVector", websearch_to_tsquery('english', ${q})),
          similarity(e.title, ${q})
        ) AS rank
      FROM events e
      JOIN guide_profiles g ON g.id = e."guideId"
      JOIN users u ON u.id = g."userId"
      WHERE e."isPublished" = true
        AND e."isCancelled" = false
        AND u."isActive" = true
        AND (
          e."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(e.title, ${q}) > ${SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC, e."startTime" ASC
      LIMIT ${hitsPerPage} OFFSET ${skip}
    `;
    const [{ count }] = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM events e
      JOIN guide_profiles g ON g.id = e."guideId"
      JOIN users u ON u.id = g."userId"
      WHERE e."isPublished" = true
        AND e."isCancelled" = false
        AND u."isActive" = true
        AND (
          e."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(e.title, ${q}) > ${SIMILARITY_THRESHOLD}
        )
    `;
    return { hits, nbHits: Number(count), page, hitsPerPage };
  }

  async searchTours(query: string, page = 0, hitsPerPage = 20) {
    const q = this.cleanQuery(query);
    const skip = page * hitsPerPage;
    if (!q) return { hits: [], nbHits: 0, page, hitsPerPage };

    const hits = await this.prisma.$queryRaw<Array<{
      id: string; slug: string; title: string; shortDesc: string | null;
      location: string | null; country: string | null;
      coverImageUrl: string | null; startDate: Date;
      basePrice: string; guideName: string; guideSlug: string; rank: number;
    }>>`
      SELECT
        t.id,
        t.slug,
        t.title,
        t."shortDesc",
        t.location,
        t.country,
        t."coverImageUrl",
        t."startDate",
        t."basePrice"::text AS "basePrice",
        g."displayName" AS "guideName",
        g.slug AS "guideSlug",
        GREATEST(
          ts_rank_cd(t."searchVector", websearch_to_tsquery('english', ${q})),
          similarity(t.title, ${q}),
          word_similarity(${q}, coalesce(t."shortDesc", '')) * 0.85
        ) AS rank
      FROM soul_tours t
      JOIN guide_profiles g ON g.id = t."guideId"
      JOIN users u ON u.id = g."userId"
      WHERE t."isPublished" = true
        AND t."isCancelled" = false
        AND u."isActive" = true
        AND (
          t."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(t.title, ${q}) > ${SIMILARITY_THRESHOLD}
          OR word_similarity(${q}, coalesce(t."shortDesc", '')) > ${WORD_SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC, t."startDate" ASC
      LIMIT ${hitsPerPage} OFFSET ${skip}
    `;
    const [{ count }] = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM soul_tours t
      JOIN guide_profiles g ON g.id = t."guideId"
      JOIN users u ON u.id = g."userId"
      WHERE t."isPublished" = true
        AND t."isCancelled" = false
        AND u."isActive" = true
        AND (
          t."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(t.title, ${q}) > ${SIMILARITY_THRESHOLD}
          OR word_similarity(${q}, coalesce(t."shortDesc", '')) > ${WORD_SIMILARITY_THRESHOLD}
        )
    `;
    return { hits, nbHits: Number(count), page, hitsPerPage };
  }

  async searchBlog(query: string, page = 0, hitsPerPage = 20) {
    const q = this.cleanQuery(query);
    const skip = page * hitsPerPage;
    if (!q) return { hits: [], nbHits: 0, page, hitsPerPage };

    const hits = await this.prisma.$queryRaw<Array<{
      id: string; slug: string; title: string; excerpt: string | null;
      coverImageUrl: string | null; tags: string[]; publishedAt: Date | null;
      guideName: string; guideSlug: string; guideAvatarUrl: string | null;
      rank: number;
    }>>`
      SELECT
        b.id,
        b.slug,
        b.title,
        b.excerpt,
        b."coverImageUrl",
        b.tags,
        b."publishedAt",
        g."displayName" AS "guideName",
        g.slug AS "guideSlug",
        u."avatarUrl" AS "guideAvatarUrl",
        GREATEST(
          ts_rank_cd(b."searchVector", websearch_to_tsquery('english', ${q})),
          similarity(b.title, ${q})
        ) AS rank
      FROM blog_posts b
      JOIN guide_profiles g ON g.id = b."guideId"
      JOIN users u ON u.id = g."userId"
      WHERE b."isPublished" = true
        AND u."isActive" = true
        AND (
          b."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(b.title, ${q}) > ${SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC, b."publishedAt" DESC
      LIMIT ${hitsPerPage} OFFSET ${skip}
    `;
    const [{ count }] = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM blog_posts b
      JOIN guide_profiles g ON g.id = b."guideId"
      JOIN users u ON u.id = g."userId"
      WHERE b."isPublished" = true
        AND u."isActive" = true
        AND (
          b."searchVector" @@ websearch_to_tsquery('english', ${q})
          OR similarity(b.title, ${q}) > ${SIMILARITY_THRESHOLD}
        )
    `;
    return { hits, nbHits: Number(count), page, hitsPerPage };
  }

  // ─── Cross-entity search ───────────────────────────────────────────────────
  //
  // Returns a top-N from each of the 5 entities. Frontend can present
  // grouped results (e.g. "Practitioners (3) · Products (5) · Tours (2)").
  // We don't UNION across all five because cross-entity rank comparisons
  // are misleading (a guide's rank=0.4 isn't comparable to a tour's
  // rank=0.4 — different weight bases).

  async searchAll(query: string, perEntity = 5) {
    const q = this.cleanQuery(query);
    if (!q) {
      return { guides: [], products: [], events: [], tours: [], blog: [] };
    }
    const [guides, products, events, tours, blog] = await Promise.all([
      this.searchGuides(q, 0, perEntity).then((r) => r.hits),
      this.searchProducts(q, 0, perEntity).then((r) => r.hits),
      this.searchEvents(q, 0, perEntity).then((r) => r.hits),
      this.searchTours(q, 0, perEntity).then((r) => r.hits),
      this.searchBlog(q, 0, perEntity).then((r) => r.hits),
    ]);
    return { guides, products, events, tours, blog };
  }
}
