import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
    const slug = await this.uniqueSlug(guide.id, baseSlug);

    const post = await this.prisma.blogPost.create({
      data: {
        guideId: guide.id,
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
    return this.prisma.blogPost.findMany({
      where: { guideId, isPublished: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  // ─── List All Published Posts (Public Journal Page) ─────────────────────────

  async findAllPublished(page = 1, limit = 12, tag?: string) {
    const skip = (page - 1) * limit;

    const where: any = { isPublished: true };
    if (tag) {
      where.tags = { has: tag };
    }

    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
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
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Single Post by Slug (Public) ───────────────────────────────────────

  async findBySlug(guideSlug: string, postSlug: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { slug: guideSlug },
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
      data.slug = await this.uniqueSlug(guide.id, slugify(dto.title), postId);
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

  private async uniqueSlug(guideId: string, baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await this.prisma.blogPost.findFirst({
        where: {
          guideId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
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
