import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { PaginationQueryDto } from './dto/query.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { RejectGuideDto } from './dto/reject-guide.dto';
import { VerificationStatus } from '@prisma/client';
declare class GuidesQueryDto extends PaginationQueryDto {
    status?: VerificationStatus;
}
export declare class AdminController {
    private readonly adminService;
    private readonly config;
    constructor(adminService: AdminService, config: ConfigService);
    getDashboard(): Promise<{
        totalUsers: number;
        totalGuides: number;
        totalBookings: number;
        totalRevenue: number;
        pendingVerifications: number;
        newUsersThisWeek: number;
    }>;
    getIntegrationStatus(): {
        name: string;
        description: string;
        detail: string;
        status: string;
    }[];
    getUsers(query: PaginationQueryDto): Promise<{
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
    getUserDetail(id: string): Promise<{
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
            websiteUrl: string | null;
            instagramUrl: string | null;
            youtubeUrl: string | null;
            languages: string[];
            modalities: string[];
            issuesHelped: string[];
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
    banUser(id: string, dto: BanUserDto): Promise<{
        id: string;
        isBanned: boolean;
        bannedReason: string | null;
    }>;
    unbanUser(id: string): Promise<{
        id: string;
        isBanned: boolean;
    }>;
    setUserRoles(id: string, dto: UpdateRolesDto): Promise<{
        id: string;
        roles: {
            id: string;
            createdAt: Date;
            role: import(".prisma/client").$Enums.Role;
            userId: string;
        }[];
    } | null>;
    getGuides(query: GuidesQueryDto): Promise<{
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
    getVerificationQueue(query: PaginationQueryDto): Promise<{
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
    rejectGuide(guideId: string, dto: RejectGuideDto): Promise<{
        id: string;
        verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
    }>;
    getFinancials(query: PaginationQueryDto): Promise<{
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
export {};
