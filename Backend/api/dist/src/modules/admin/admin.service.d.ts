import { PrismaService } from '../../database/prisma.service';
import { Role, VerificationStatus } from '@prisma/client';
export declare class AdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDashboardStats(): Promise<{
        totalUsers: number;
        totalGuides: number;
        totalBookings: number;
        totalRevenue: number;
        pendingVerifications: number;
        newUsersThisWeek: number;
    }>;
    getUsers(params: {
        page: number;
        limit: number;
        search?: string;
    }): Promise<{
        users: {
            id: string;
            isActive: boolean;
            createdAt: Date;
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
            phone: string | null;
            isEmailVerified: boolean;
            isBanned: boolean;
            bannedReason: string | null;
            lastLoginAt: Date | null;
            roles: {
                role: import(".prisma/client").$Enums.Role;
            }[];
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getUserDetail(userId: string): Promise<{
        roles: {
            id: string;
            createdAt: Date;
            role: import(".prisma/client").$Enums.Role;
            userId: string;
        }[];
        seekerProfile: {
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
        } | null;
        guideProfile: ({
            services: {
                id: string;
                name: string;
                description: string | null;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                guideId: string;
                type: import(".prisma/client").$Enums.ServiceType;
                price: import("@prisma/client-runtime-utils").Decimal;
                currency: string;
                durationMin: number;
            }[];
            credentials: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
                guideId: string;
                title: string;
                institution: string | null;
                issuedYear: number | null;
                documentUrl: string | null;
                confidenceScore: number | null;
                extractedData: import("@prisma/client/runtime/client").JsonValue | null;
                adminNotes: string | null;
                verifiedAt: Date | null;
            }[];
        } & {
            id: string;
            slug: string;
            createdAt: Date;
            updatedAt: Date;
            bio: string | null;
            location: string | null;
            timezone: string | null;
            userId: string;
            claimToken: string | null;
            displayName: string;
            tagline: string | null;
            studioName: string | null;
            streetAddress: string | null;
            city: string | null;
            state: string | null;
            zipCode: string | null;
            country: string | null;
            websiteUrl: string | null;
            instagramUrl: string | null;
            youtubeUrl: string | null;
            languages: string[];
            modalities: string[];
            issuesHelped: string[];
            yearsExperience: number | null;
            calendarType: string | null;
            calendarLink: string | null;
            sessionPricingJson: string | null;
            calendlyConnected: boolean;
            calendlyAccessToken: string | null;
            calendlyRefreshToken: string | null;
            calendlyUserUri: string | null;
            isPublished: boolean;
            isVerified: boolean;
            verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
            onboardingPath: import(".prisma/client").$Enums.OnboardingPath;
            stripeAccountId: string | null;
            stripeOnboardingDone: boolean;
            algoliaObjectId: string | null;
            averageRating: number;
            totalReviews: number;
            claimTokenExpiry: Date | null;
            scrapedSourceUrl: string | null;
        }) | null;
    } & {
        id: string;
        isActive: boolean;
        createdAt: Date;
        email: string;
        googleId: string | null;
        passwordHash: string | null;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isBanned: boolean;
        bannedReason: string | null;
        emailVerifyToken: string | null;
        emailVerifyExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
        lastLoginAt: Date | null;
        marketingEmails: boolean;
        updatedAt: Date;
    }>;
    banUser(userId: string, reason?: string): Promise<{
        id: string;
        isBanned: boolean;
        bannedReason: string | null;
    }>;
    unbanUser(userId: string): Promise<{
        id: string;
        isBanned: boolean;
    }>;
    setUserRoles(userId: string, roles: Role[]): Promise<{
        id: string;
        roles: {
            id: string;
            createdAt: Date;
            role: import(".prisma/client").$Enums.Role;
            userId: string;
        }[];
    } | null>;
    getGuides(params: {
        page: number;
        limit: number;
        search?: string;
        status?: VerificationStatus;
    }): Promise<{
        guides: {
            id: string;
            createdAt: Date;
            user: {
                id: string;
                isActive: boolean;
                email: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
                isBanned: boolean;
            };
            location: string | null;
            displayName: string;
            tagline: string | null;
            verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
            averageRating: number;
            totalReviews: number;
            credentials: {
                id: string;
                verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
                title: string;
            }[];
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getVerificationQueue(params: {
        page: number;
        limit: number;
    }): Promise<{
        guides: {
            id: string;
            createdAt: Date;
            user: {
                id: string;
                email: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
            };
            location: string | null;
            displayName: string;
            tagline: string | null;
            verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
            credentials: {
                id: string;
                verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
                title: string;
                institution: string | null;
                issuedYear: number | null;
                documentUrl: string | null;
            }[];
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    approveGuide(guideId: string): Promise<{
        id: string;
        verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
    }>;
    rejectGuide(guideId: string, reason: string): Promise<{
        id: string;
        verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
    }>;
    getFinancials(params: {
        page: number;
        limit: number;
    }): Promise<{
        summary: {
            totalRevenue: number;
            monthlyRevenue: number;
            totalPayments: number;
        };
        revenueByMonth: {
            month: string;
            revenue: number;
        }[];
        payments: {
            id: string;
            createdAt: Date;
            booking: {
                service: {
                    guide: {
                        user: {
                            firstName: string;
                            lastName: string;
                        };
                        displayName: string;
                    };
                };
                seeker: {
                    user: {
                        firstName: string;
                        lastName: string;
                    };
                };
            } | null;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
