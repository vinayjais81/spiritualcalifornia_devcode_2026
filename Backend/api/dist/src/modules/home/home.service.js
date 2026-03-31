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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let HomeService = class HomeService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getHomePageData() {
        const [featuredGuides, recentBlogPosts, activeProducts, upcomingEvents, soulTravelEvents,] = await Promise.all([
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
    async getFeaturedGuides() {
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
    async getRecentBlogPosts() {
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
    async getActiveProducts() {
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
    async getUpcomingEvents() {
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
    async getSoulTravelEvents() {
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
};
exports.HomeService = HomeService;
exports.HomeService = HomeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HomeService);
//# sourceMappingURL=home.service.js.map