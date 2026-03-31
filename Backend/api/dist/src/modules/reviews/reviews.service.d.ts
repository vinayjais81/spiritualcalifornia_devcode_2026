import { PrismaService } from '../../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
export declare class ReviewsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    checkEligibility(userId: string, bookingId: string): Promise<{
        eligible: boolean;
        reason: string | null;
        booking: {
            id: string;
            status: import(".prisma/client").$Enums.BookingStatus;
            guideName: string;
            guideUserId: string;
            alreadyReviewed: boolean;
        };
    }>;
    create(userId: string, dto: CreateReviewDto): Promise<{
        author: {
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
    }>;
    findMyReviews(userId: string): Promise<({
        booking: {
            service: {
                name: string;
                guide: {
                    slug: string;
                    displayName: string;
                };
            };
        };
        target: {
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
    })[]>;
    getReviewableBookings(userId: string): Promise<({
        service: {
            name: string;
            guide: {
                slug: string;
                user: {
                    avatarUrl: string | null;
                };
                displayName: string;
            };
        };
        slot: {
            startTime: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        serviceId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
        seekerId: string;
        slotId: string;
    })[]>;
    flagReview(reviewId: string, flag: boolean): Promise<{
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
    }>;
    moderateReview(reviewId: string, approved: boolean): Promise<{
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
    }>;
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
