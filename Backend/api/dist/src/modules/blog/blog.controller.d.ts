import { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
export declare class BlogController {
    private readonly blogService;
    constructor(blogService: BlogService);
    create(user: CurrentUserData, dto: CreatePostDto): Promise<{
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
    findMine(user: CurrentUserData): Promise<{
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
    findAll(page?: number, limit?: number, tag?: string): Promise<{
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
    update(user: CurrentUserData, id: string, dto: UpdatePostDto): Promise<{
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
    delete(user: CurrentUserData, id: string): Promise<{
        deleted: boolean;
    }>;
}
