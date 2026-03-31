import { ReviewsService } from './reviews.service';
export declare class ReviewsController {
    private readonly reviewsService;
    constructor(reviewsService: ReviewsService);
    findByGuide(userId: string, page?: number, limit?: number): Promise<{
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
    findTestimonials(guideId: string): Promise<({
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
}
