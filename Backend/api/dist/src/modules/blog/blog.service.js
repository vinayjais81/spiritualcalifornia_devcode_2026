"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BlogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
let BlogService = BlogService_1 = class BlogService {
    prisma;
    logger = new common_1.Logger(BlogService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        const guide = await this.findGuideOrFail(userId);
        if (dto.publish && !dto.coverImageUrl) {
            throw new common_1.BadRequestException('A cover image is required to publish a blog post.');
        }
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
    async findByGuide(userId) {
        const guide = await this.findGuideOrFail(userId);
        return this.prisma.blogPost.findMany({
            where: { guideId: guide.id },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findPublishedByGuideId(guideId) {
        return this.prisma.blogPost.findMany({
            where: { guideId, isPublished: true },
            orderBy: { publishedAt: 'desc' },
        });
    }
    async findAllPublished(page = 1, limit = 12, tag) {
        const skip = (page - 1) * limit;
        const where = { isPublished: true };
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
    async findBySlug(guideSlug, postSlug) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { slug: guideSlug },
            select: { id: true },
        });
        if (!guide) {
            throw new common_1.NotFoundException('Guide not found');
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
            throw new common_1.NotFoundException('Blog post not found');
        }
        return post;
    }
    async update(userId, postId, dto) {
        const guide = await this.findGuideOrFail(userId);
        const post = await this.findPostOrFail(postId);
        if (post.guideId !== guide.id) {
            throw new common_1.ForbiddenException('You can only edit your own posts');
        }
        const data = {};
        if (dto.title !== undefined) {
            data.title = dto.title;
            data.slug = await this.uniqueSlug(guide.id, slugify(dto.title), postId);
        }
        if (dto.content !== undefined)
            data.content = dto.content;
        if (dto.excerpt !== undefined)
            data.excerpt = dto.excerpt;
        if (dto.coverImageUrl !== undefined)
            data.coverImageUrl = dto.coverImageUrl;
        if (dto.tags !== undefined)
            data.tags = dto.tags;
        if (dto.publish === true && !post.isPublished) {
            const hasCover = dto.coverImageUrl || post.coverImageUrl;
            if (!hasCover) {
                throw new common_1.BadRequestException('A cover image is required to publish a blog post.');
            }
            await this.enforcePublishRateLimit(guide.id);
            data.isPublished = true;
            data.publishedAt = new Date();
        }
        else if (dto.publish === false) {
            data.isPublished = false;
        }
        const updated = await this.prisma.blogPost.update({
            where: { id: postId },
            data,
        });
        this.logger.log(`Blog post "${updated.title}" updated by guide ${guide.id}`);
        return updated;
    }
    async delete(userId, postId) {
        const guide = await this.findGuideOrFail(userId);
        const post = await this.findPostOrFail(postId);
        if (post.guideId !== guide.id) {
            throw new common_1.ForbiddenException('You can only delete your own posts');
        }
        await this.prisma.blogPost.delete({ where: { id: postId } });
        this.logger.log(`Blog post "${post.title}" deleted by guide ${guide.id}`);
        return { deleted: true };
    }
    async enforcePublishRateLimit(guideId) {
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
            const nextAllowed = new Date(recentPost.publishedAt.getTime() + 24 * 60 * 60 * 1000);
            throw new common_1.BadRequestException(`You can publish one post per 24 hours. Next post allowed at ${nextAllowed.toISOString()}`);
        }
    }
    async uniqueSlug(guideId, baseSlug, excludeId) {
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
            if (!existing)
                return slug;
            counter++;
            slug = `${baseSlug}-${counter}`;
        }
    }
    async findGuideOrFail(userId) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { userId },
        });
        if (!guide) {
            throw new common_1.NotFoundException('Guide profile not found. Complete onboarding first.');
        }
        return guide;
    }
    async findPostOrFail(postId) {
        const post = await this.prisma.blogPost.findUnique({
            where: { id: postId },
        });
        if (!post) {
            throw new common_1.NotFoundException('Blog post not found');
        }
        return post;
    }
};
exports.BlogService = BlogService;
exports.BlogService = BlogService = BlogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BlogService);
//# sourceMappingURL=blog.service.js.map