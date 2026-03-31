import { PrismaService } from '../../database/prisma.service';
export declare class ReviewsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByGuideUserId(guideUserId: string, page?: number, limit?: number): Promise<{
        reviews: ({
            author: {
                id: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            isApproved: boolean;
            updatedAt: Date;
            title: string | null;
            bookingId: string;
            rating: number;
            body: string | null;
            isFlagged: boolean;
            authorId: string;
            targetId: string;
        })[];
        ratingDistribution: Record<number, number>;
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    findTestimonialsByGuideId(guideId: string): Promise<({
        author: {
            id: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        isApproved: boolean;
        body: string;
        authorId: string;
        targetGuideId: string;
    })[]>;
    getRatingSummary(guideUserId: string): Promise<{
        averageRating: number;
        totalReviews: number;
    }>;
}
