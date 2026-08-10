import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuthorKind } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The public visibility gate for a post.
 *
 * Two things are load-bearing here.
 *
 * `publishedAt: { lte: now }` — without it, `isPublished` alone would expose a
 * post the moment it is flagged, regardless of its date. The imported library
 * carries real publication dates and the importer is allowed to set future
 * ones, so a post scheduled for next month must stay invisible until then.
 *
 * The `OR` — editorial posts carry `guideId: null`. A bare
 * `guide: { user: { isActive: true } }` is an inner-join style filter that drops
 * every row whose guide is null, so writing the obvious thing would make the
 * entire imported library invisible while looking perfectly correct. Editorial
 * posts belong to the publication and have no guide to deactivate; guide posts
 * still hide when their author is deactivated.
 */
function publicPostWhere(extra: Record<string, unknown> = {}) {
  return {
    isPublished: true,
    publishedAt: { lte: new Date() },
    OR: [{ guideId: null }, { guide: { user: { isActive: true } } }],
    ...extra,
  };
}

/**
 * Fields never sent to a public client.
 *
 * `evidenceTier` is internal editorial metadata that calibrates the language
 * writers may use. The style spec is explicit that it must not render anywhere —
 * no badge, no label, no tooltip — because readers do not know what the tiers
 * mean. Stripping it at the serialiser rather than just omitting it from the
 * template means it cannot leak through an API response either.
 */
export function stripInternalFields<T extends Record<string, any>>(post: T): Omit<T, 'evidenceTier'> {
  const { evidenceTier: _evidenceTier, ...rest } = post;
  return rest;
}

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Create Post ────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreatePostDto) {
    const guide = await this.findGuideOrFail(userId);

    // Cover image required for publishing
    if (dto.publish && !dto.coverImageUrl) {
      throw new BadRequestException('A cover image is required to publish a blog post.');
    }

    // 1-post-per-24h rate limit (only for published posts)
    if (dto.publish) {
      await this.enforcePublishRateLimit(guide.id);
    }

    const baseSlug = slugify(dto.title);
    const slug = await this.uniqueSlug(baseSlug);

    const post = await this.prisma.blogPost.create({
      data: {
        guideId: guide.id,
        // Recorded on every post regardless of kind. Independent of guideId so
        // it survives guide-profile deletion.
        authorUserId: userId,
        authorKind: AuthorKind.GUIDE,
        title: dto.title,
        slug,
        content: dto.content,
        excerpt: dto.excerpt || dto.content.replace(/<[^>]*>/g, '').substring(0, 200),
        coverImageUrl: dto.coverImageUrl,
        tags: dto.tags || [],
        isPublished: dto.publish ?? false,
        publishedAt: dto.publish ? new Date() : null,
      },
    });

    this.logger.log(`Blog post "${post.title}" created by guide ${guide.id}`);
    return post;
  }

  // ─── List My Posts (Guide Dashboard) ────────────────────────────────────────

  async findByGuide(userId: string) {
    const guide = await this.findGuideOrFail(userId);

    return this.prisma.blogPost.findMany({
      where: { guideId: guide.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── List Published Posts by Guide ID (Public Profile) ──────────────────────

  async findPublishedByGuideId(guideId: string) {
    const posts = await this.prisma.blogPost.findMany({
      // Defensive: callers usually pass a guideId that's already passed the
      // public profile's isActive gate, but enforcing here means stray
      // callers can never leak posts from a deactivated guide.
      where: publicPostWhere({ guideId }),
      orderBy: { publishedAt: 'desc' },
    });
    return posts.map(stripInternalFields);
  }

  // ─── List All Published Posts (Public Journal Page) ─────────────────────────

  async findAllPublished(page = 1, limit = 12, tag?: string, category?: string) {
    const skip = (page - 1) * limit;

    // Hide posts whose guide has been deactivated by an admin, and posts whose
    // publication date has not arrived yet.
    const extra: Record<string, unknown> = {};
    if (tag) extra.tags = { has: tag };
    // Exact match on the editorial label rather than a contains: the tab list
    // is built from these same values, so a tab can only ever be an exact one.
    if (category) extra.categoryLabel = category;
    const where: any = publicPostWhere(extra);

    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        // Admin-managed sortOrder primary; publishedAt breaks ties so
        // unsorted posts still feel "fresh first".
        // The importer assigns sortOrder 1–124 from the original editorial
        // calendar. That matters more than it looks: the client asked for every
        // imported article to carry the import date, so publishedAt is identical
        // across the library and cannot break a tie. Without a distinct
        // sortOrder the order would be undefined and pagination unstable —
        // the same article could appear on two pages.
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        include: {
          guide: {
            select: {
              id: true,
              slug: true,
              displayName: true,
              user: { select: { avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return {
      posts: posts.map(stripInternalFields),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Category Tabs (Public) ────────────────────────────────────────────────

  /**
   * The journal's filter tabs, derived from what is actually published.
   *
   * These were previously a hardcoded array — ['All', 'Spiritual Practices',
   * 'Sound Healing', 'Meditation', 'Wellness', 'Sacred Living'] — that matched
   * no field in the database, so every tab filtered nothing and several named
   * topics the library does not contain.
   *
   * Grouping on live data means the tabs cannot drift from the content: import
   * an article in a new category and its tab appears; remove the last one and
   * the tab goes away.
   */
  async getCategories() {
    const grouped = await this.prisma.blogPost.groupBy({
      by: ['categoryLabel'],
      where: publicPostWhere({ categoryLabel: { not: null } }),
      _count: { _all: true },
      orderBy: { _count: { categoryLabel: 'desc' } },
    });

    const total = await this.prisma.blogPost.count({ where: publicPostWhere() });

    // Topic chips, aggregated across the whole library rather than the page
    // currently on screen. Deriving them client-side from loaded posts meant
    // they described 24 of 124 articles — and changed completely on every
    // search, so they were never a stable way to browse.
    //
    // Raw SQL because `tags` is a text[]: unnest is the only way to group by
    // element. Conditions mirror publicPostWhere() exactly — including the
    // guideId IS NULL branch, without which every editorial article's tags
    // would be missing.
    const topics = await this.prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
      SELECT t.tag AS tag, COUNT(*)::bigint AS count
      FROM blog_posts b
      LEFT JOIN guide_profiles g ON g.id = b."guideId"
      LEFT JOIN users u ON u.id = g."userId"
      CROSS JOIN LATERAL unnest(b.tags) AS t(tag)
      WHERE b."isPublished" = true
        AND b."publishedAt" <= NOW()
        AND (b."guideId" IS NULL OR u."isActive" = true)
      GROUP BY t.tag
      ORDER BY count DESC, t.tag ASC
      LIMIT 24
    `;

    return {
      total,
      categories: grouped
        .filter((g) => g.categoryLabel)
        .map((g) => ({ label: g.categoryLabel as string, count: g._count._all })),
      topics: topics.map((t) => ({ tag: t.tag, count: Number(t.count) })),
    };
  }

  // ─── Get Single Post by Slug (Public) ───────────────────────────────────────

  /**
   * Primary public lookup. Slugs are globally unique, so a post is addressable
   * at /journal/{slug} with no author segment — the client's routing decision
   * of 2026-08-10. Serves editorial and practitioner posts identically.
   */
  async findByFlatSlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: publicPostWhere({ slug }),
      include: {
        guide: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            tagline: true,
            isVerified: true,
            user: { select: { avatarUrl: true } },
          },
        },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return stripInternalFields(post);
  }

  /**
   * Legacy lookup for the old /journal/{guideSlug}/{postSlug} URLs. Retained
   * only so those links can resolve to a redirect rather than 404.
   */
  async findBySlug(guideSlug: string, postSlug: string) {
    const guide = await this.prisma.guideProfile.findFirst({
      // 404 if the guide's account has been deactivated — matches the
      // public profile behaviour (getPublicProfile 404s for the same case).
      where: { slug: guideSlug, user: { isActive: true } },
      select: { id: true },
    });

    if (!guide) {
      throw new NotFoundException('Guide not found');
    }

    const post = await this.prisma.blogPost.findFirst({
      where: { guideId: guide.id, slug: postSlug, isPublished: true },
      include: {
        guide: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            tagline: true,
            isVerified: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return post;
  }

  // ─── Applaud (clap) a Post (Public) ─────────────────────────────────────────
  // Simple running total. The client dedupes per-device via localStorage, so
  // we don't track individual applause rows — a single increment per call.

  async applaud(postId: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { id: postId, isPublished: true },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    const updated = await this.prisma.blogPost.update({
      where: { id: postId },
      data: { applauseCount: { increment: 1 } },
      select: { applauseCount: true },
    });

    return { applauseCount: updated.applauseCount };
  }

  // ─── Update Post ────────────────────────────────────────────────────────────

  async update(userId: string, postId: string, dto: UpdatePostDto) {
    const guide = await this.findGuideOrFail(userId);
    const post = await this.findPostOrFail(postId);

    if (post.guideId !== guide.id) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    const data: any = {};

    if (dto.title !== undefined) {
      data.title = dto.title;
      data.slug = await this.uniqueSlug(slugify(dto.title), postId);
    }
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.tags !== undefined) data.tags = dto.tags;

    if (dto.publish === true && !post.isPublished) {
      // Cover image required for publishing
      const hasCover = dto.coverImageUrl || post.coverImageUrl;
      if (!hasCover) {
        throw new BadRequestException('A cover image is required to publish a blog post.');
      }
      await this.enforcePublishRateLimit(guide.id);
      data.isPublished = true;
      data.publishedAt = new Date();
    } else if (dto.publish === false) {
      data.isPublished = false;
    }

    const updated = await this.prisma.blogPost.update({
      where: { id: postId },
      data,
    });

    this.logger.log(`Blog post "${updated.title}" updated by guide ${guide.id}`);
    return updated;
  }

  // ─── Delete Post ────────────────────────────────────────────────────────────

  async delete(userId: string, postId: string) {
    const guide = await this.findGuideOrFail(userId);
    const post = await this.findPostOrFail(postId);

    if (post.guideId !== guide.id) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.blogPost.delete({ where: { id: postId } });

    this.logger.log(`Blog post "${post.title}" deleted by guide ${guide.id}`);
    return { deleted: true };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async enforcePublishRateLimit(guideId: string) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentPost = await this.prisma.blogPost.findFirst({
      where: {
        guideId,
        isPublished: true,
        publishedAt: { gte: twentyFourHoursAgo },
      },
      orderBy: { publishedAt: 'desc' },
    });

    if (recentPost) {
      const nextAllowed = new Date(recentPost.publishedAt!.getTime() + 24 * 60 * 60 * 1000);
      throw new BadRequestException(
        `You can publish one post per 24 hours. Next post allowed at ${nextAllowed.toISOString()}`,
      );
    }
  }

  /**
   * Slugs are unique across the whole table, not per author.
   *
   * Behaviour change for practitioners: two guides could previously each
   * publish `my-healing-journey`, because uniqueness was scoped by guideId.
   * Flat /journal/{slug} URLs mean a slug can only belong to one post
   * site-wide, so the second author now silently gets `my-healing-journey-1`.
   */
  private async uniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await this.prisma.blogPost.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) return slug;
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  private async findGuideOrFail(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
    });

    if (!guide) {
      throw new NotFoundException('Guide profile not found. Complete onboarding first.');
    }

    return guide;
  }

  private async findPostOrFail(postId: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return post;
  }
}
