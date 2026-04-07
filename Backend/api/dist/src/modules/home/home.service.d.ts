import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';
export declare class HomeService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    getHomePageData(): Promise<{
        featuredGuides: {
            id: string;
            slug: string;
            displayName: string;
            tagline: string | null;
            location: string | null;
            avatarUrl: string | null;
            isVerified: boolean;
            averageRating: number;
            totalReviews: number;
            specialties: string[];
        }[];
        recentBlogPosts: {
            id: string;
            title: string;
            slug: string;
            excerpt: string | null;
            coverImageUrl: string | null;
            tags: string[];
            publishedAt: Date | null;
            guide: {
                slug: string;
                displayName: string;
                avatarUrl: string | null;
            };
        }[];
        activeProducts: {
            id: string;
            name: string;
            description: string | null;
            type: import(".prisma/client").$Enums.ProductType;
            price: import("@prisma/client-runtime-utils").Decimal;
            imageUrls: string[];
            guide: {
                slug: string;
                displayName: string;
                avatarUrl: string | null;
            };
        }[];
        upcomingEvents: {
            id: string;
            title: string;
            type: import(".prisma/client").$Enums.EventType;
            startTime: Date;
            endTime: Date;
            location: string | null;
            coverImageUrl: string | null;
            startingPrice: import("@prisma/client-runtime-utils").Decimal;
            spotsLeft: number | null;
            guide: {
                slug: string;
                displayName: string;
                avatarUrl: string | null;
            };
        }[];
        soulTravelEvents: {
            id: string;
            slug: string;
            title: string;
            startTime: Date;
            endTime: Date;
            location: string | null;
            coverImageUrl: string | null;
            startingPrice: number;
            guide: {
                slug: string;
                displayName: string;
                avatarUrl: string | null;
            };
        }[];
    }>;
    private _fetchHomeData;
    private getFeaturedGuides;
    private getRecentBlogPosts;
    private getActiveProducts;
    private getUpcomingEvents;
    private getSoulTravelEvents;
}
