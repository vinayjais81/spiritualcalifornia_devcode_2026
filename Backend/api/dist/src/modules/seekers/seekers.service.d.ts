import { PrismaService } from '../../database/prisma.service';
export declare class SeekersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getOnboardingStatus(userId: string): Promise<{
        step: number;
        completed: boolean;
    }>;
    updateOnboardingStep(userId: string, step: number, completed?: boolean): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        bio: string | null;
        location: string | null;
        timezone: string | null;
        interests: string[];
        onboardingStep: number;
        onboardingCompleted: boolean;
        userId: string;
    }>;
    getMyProfile(userId: string): Promise<{
        user: {
            id: string;
            createdAt: Date;
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
            phone: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        bio: string | null;
        location: string | null;
        timezone: string | null;
        interests: string[];
        onboardingStep: number;
        onboardingCompleted: boolean;
        userId: string;
    }>;
    updateProfile(userId: string, dto: {
        bio?: string;
        location?: string;
        timezone?: string;
        interests?: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        bio: string | null;
        location: string | null;
        timezone: string | null;
        interests: string[];
        onboardingStep: number;
        onboardingCompleted: boolean;
        userId: string;
    }>;
    getDashboardStats(userId: string): Promise<{
        totalBookings: number;
        upcomingBookings: number;
        completedBookings: number;
        totalSpent: number;
        favoriteGuides: number;
    }>;
    getPaymentHistory(userId: string): Promise<({
        booking: {
            id: string;
            service: {
                name: string;
                guide: {
                    displayName: string;
                };
            };
            slot: {
                startTime: Date;
            };
        } | null;
        order: {
            id: string;
            items: {
                product: {
                    name: string;
                };
            }[];
        } | null;
        ticketPurchase: {
            id: string;
            tier: {
                name: string;
                event: {
                    title: string;
                };
            };
        } | null;
        tourBooking: {
            id: string;
            tour: {
                title: string;
            };
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        stripePaymentIntentId: string;
        stripeCheckoutSessionId: string | null;
        stripeTransferId: string | null;
        amount: import("@prisma/client-runtime-utils").Decimal;
        platformFee: import("@prisma/client-runtime-utils").Decimal;
        guideAmount: import("@prisma/client-runtime-utils").Decimal;
        paymentType: import(".prisma/client").$Enums.PaymentType;
        refundedAmount: import("@prisma/client-runtime-utils").Decimal | null;
        stripeRefundId: string | null;
        paymentMethod: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        bookingId: string | null;
        orderId: string | null;
        ticketPurchaseId: string | null;
        tourBookingId: string | null;
    })[]>;
    getFavorites(userId: string): Promise<{
        guide: {
            id: string;
            slug: string;
            user: {
                avatarUrl: string | null;
            };
            displayName: string;
            tagline: string | null;
            isVerified: boolean;
            averageRating: number;
            totalReviews: number;
        } | null;
        seeker: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            bio: string | null;
            location: string | null;
            timezone: string | null;
            interests: string[];
            onboardingStep: number;
            onboardingCompleted: boolean;
            userId: string;
        } | {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            bio: string | null;
            location: string | null;
            timezone: string | null;
            interests: string[];
            onboardingStep: number;
            onboardingCompleted: boolean;
            userId: string;
        };
        id: string;
        createdAt: Date;
        guideId: string;
        seekerId: string;
    }[]>;
    addFavorite(userId: string, guideId: string): Promise<{
        id: string;
        createdAt: Date;
        guideId: string;
        seekerId: string;
    }>;
    removeFavorite(userId: string, guideId: string): Promise<{
        deleted: boolean;
    }>;
}
