import { PrismaService } from '../../database/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
export declare class BlogService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreatePostDto): Promise<{
        id: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        coverImageUrl: string | null;
        content: string;
        excerpt: string | null;
        tags: string[];
        publishedAt: Date | null;
    }>;
    findByGuide(userId: string): Promise<{
        id: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        coverImageUrl: string | null;
        content: string;
        excerpt: string | null;
        tags: string[];
        publishedAt: Date | null;
    }[]>;
    findPublishedByGuideId(guideId: string): Promise<{
        id: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        coverImageUrl: string | null;
        content: string;
        excerpt: string | null;
        tags: string[];
        publishedAt: Date | null;
    }[]>;
    findAllPublished(page?: number, limit?: number, tag?: string): Promise<{
        posts: ({
            guide: {
                id: string;
                slug: string;
                user: {
                    avatarUrl: string | null;
                };
                displayName: string;
            };
        } & {
            id: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
            isPublished: boolean;
            algoliaObjectId: string | null;
            guideId: string;
            title: string;
            coverImageUrl: string | null;
            content: string;
            excerpt: string | null;
            tags: string[];
            publishedAt: Date | null;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    findBySlug(guideSlug: string, postSlug: string): Promise<{
        guide: {
            id: string;
            slug: string;
            user: {
                avatarUrl: string | null;
            };
            displayName: string;
            tagline: string | null;
            isVerified: boolean;
        };
    } & {
        id: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        coverImageUrl: string | null;
        content: string;
        excerpt: string | null;
        tags: string[];
        publishedAt: Date | null;
    }>;
    update(userId: string, postId: string, dto: UpdatePostDto): Promise<{
        id: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        coverImageUrl: string | null;
        content: string;
        excerpt: string | null;
        tags: string[];
        publishedAt: Date | null;
    }>;
    delete(userId: string, postId: string): Promise<{
        deleted: boolean;
    }>;
    private enforcePublishRateLimit;
    private uniqueSlug;
    private findGuideOrFail;
    private findPostOrFail;
}
