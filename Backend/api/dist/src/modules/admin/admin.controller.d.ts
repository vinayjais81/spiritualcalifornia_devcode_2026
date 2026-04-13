import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { PaginationQueryDto } from './dto/query.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { RejectGuideDto } from './dto/reject-guide.dto';
import { VerificationStatus, TourBookingStatus, BookingStatus } from '@prisma/client';
declare class GuidesQueryDto extends PaginationQueryDto {
    status?: VerificationStatus;
}
declare class TourBookingsQueryDto extends PaginationQueryDto {
    status?: TourBookingStatus;
    guideId?: string;
}
declare class ServiceBookingsQueryDto extends PaginationQueryDto {
    status?: BookingStatus;
    guideId?: string;
}
export declare class AdminController {
    private readonly adminService;
    private readonly config;
    constructor(adminService: AdminService, config: ConfigService);
    getDashboard(): Promise<{
        totalUsers: number;
        totalGuides: number;
        totalBookings: number;
        serviceBookings: number;
        tourBookings: number;
        totalRevenue: number;
        totalServiceRevenue: number;
        totalTourRevenue: number;
        revenueThisMonth: number;
        pendingVerifications: number;
        newUsersThisWeek: number;
        topGuides: {
            guideId: string;
            displayName: string;
            name: string;
            totalRevenue: number;
            totalBookings: number;
        }[];
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
            email: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
            phone: string | null;
            isEmailVerified: boolean;
            isActive: boolean;
            isBanned: boolean;
            bannedReason: string | null;
            lastLoginAt: Date | null;
            createdAt: Date;
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
            userId: string;
            role: import(".prisma/client").$Enums.Role;
        }[];
        seekerProfile: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            bio: string | null;
            location: string | null;
            timezone: string | null;
            interests: string[];
            onboardingStep: number;
            onboardingCompleted: boolean;
        } | null;
        guideProfile: ({
            credentials: {
                verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
                id: string;
                createdAt: Date;
                updatedAt: Date;
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
            services: {
                description: string | null;
                id: string;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                guideId: string;
                type: import(".prisma/client").$Enums.ServiceType;
                price: import("@prisma/client-runtime-utils").Decimal;
                currency: string;
                durationMin: number;
            }[];
        } & {
            verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            bio: string | null;
            location: string | null;
            timezone: string | null;
            slug: string;
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
            onboardingPath: import(".prisma/client").$Enums.OnboardingPath;
            stripeAccountId: string | null;
            stripeOnboardingDone: boolean;
            algoliaObjectId: string | null;
            averageRating: number;
            totalReviews: number;
            claimToken: string | null;
            claimTokenExpiry: Date | null;
            scrapedSourceUrl: string | null;
        }) | null;
    } & {
        id: string;
        email: string;
        passwordHash: string | null;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isActive: boolean;
        isBanned: boolean;
        bannedReason: string | null;
        googleId: string | null;
        emailVerifyToken: string | null;
        emailVerifyExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
        lastLoginAt: Date | null;
        marketingEmails: boolean;
        createdAt: Date;
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
            userId: string;
            role: import(".prisma/client").$Enums.Role;
        }[];
    } | null>;
    getGuides(query: GuidesQueryDto): Promise<{
        guides: {
            verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
            user: {
                id: string;
                email: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
                isActive: boolean;
                isBanned: boolean;
            };
            id: string;
            createdAt: Date;
            credentials: {
                verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
                id: string;
                title: string;
            }[];
            location: string | null;
            displayName: string;
            tagline: string | null;
            averageRating: number;
            totalReviews: number;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getVerificationQueue(query: PaginationQueryDto): Promise<{
        guides: {
            verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
            user: {
                id: string;
                email: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
            };
            id: string;
            createdAt: Date;
            credentials: {
                verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
                id: string;
                title: string;
                institution: string | null;
                issuedYear: number | null;
                documentUrl: string | null;
            }[];
            location: string | null;
            displayName: string;
            tagline: string | null;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    approveGuide(guideId: string): Promise<{
        verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
        id: string;
    }>;
    rejectGuide(guideId: string, dto: RejectGuideDto): Promise<{
        verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
        id: string;
    }>;
    getTourBookings(query: TourBookingsQueryDto): Promise<{
        bookings: ({
            tour: {
                id: string;
                location: string | null;
                slug: string;
                title: string;
                guide: {
                    user: {
                        email: string;
                        firstName: string;
                        lastName: string;
                        avatarUrl: string | null;
                    };
                    id: string;
                    displayName: string;
                };
            };
            departure: {
                status: import(".prisma/client").$Enums.DepartureStatus;
                startDate: Date;
                endDate: Date;
            } | null;
            seeker: {
                user: {
                    email: string;
                    firstName: string;
                    lastName: string;
                    avatarUrl: string | null;
                };
            };
            roomType: {
                name: string;
                totalPrice: import("@prisma/client-runtime-utils").Decimal;
            };
            payments: {
                amount: import("@prisma/client-runtime-utils").Decimal;
                platformFee: import("@prisma/client-runtime-utils").Decimal;
                status: import(".prisma/client").$Enums.PaymentStatus;
                guideAmount: import("@prisma/client-runtime-utils").Decimal;
                id: string;
                createdAt: Date;
                paymentType: import(".prisma/client").$Enums.PaymentType;
            }[];
            travelers_rel: {
                id: string;
                firstName: string;
                lastName: string;
                isPrimary: boolean;
                nationality: string;
            }[];
        } & {
            status: import(".prisma/client").$Enums.TourBookingStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            tourId: string;
            departureId: string | null;
            seekerId: string;
            roomTypeId: string;
            travelers: number;
            totalAmount: import("@prisma/client-runtime-utils").Decimal;
            depositAmount: import("@prisma/client-runtime-utils").Decimal | null;
            chosenDepositAmount: import("@prisma/client-runtime-utils").Decimal | null;
            depositPaidAt: Date | null;
            balanceAmount: import("@prisma/client-runtime-utils").Decimal | null;
            balanceDueAt: Date | null;
            balanceReminderSentAt: Date | null;
            balancePaidAt: Date | null;
            holdExpiresAt: Date | null;
            bookingReference: string | null;
            paymentMethod: string | null;
            dietaryRequirements: string | null;
            dietaryNotes: string | null;
            healthConditions: string | null;
            intentions: string | null;
            specialRequests: string | null;
            contactFirstName: string;
            contactLastName: string;
            contactEmail: string;
            contactPhone: string | null;
            cancelledAt: Date | null;
            cancellationReason: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        statusCounts: Record<string, number>;
    }>;
    getServiceBookings(query: ServiceBookingsQueryDto): Promise<{
        bookings: ({
            service: {
                id: string;
                name: string;
                guide: {
                    user: {
                        email: string;
                        firstName: string;
                        lastName: string;
                        avatarUrl: string | null;
                    };
                    id: string;
                    displayName: string;
                };
                type: import(".prisma/client").$Enums.ServiceType;
                price: import("@prisma/client-runtime-utils").Decimal;
                durationMin: number;
            };
            seeker: {
                user: {
                    id: string;
                    email: string;
                    firstName: string;
                    lastName: string;
                    avatarUrl: string | null;
                };
            };
            payment: {
                amount: import("@prisma/client-runtime-utils").Decimal;
                platformFee: import("@prisma/client-runtime-utils").Decimal;
                status: import(".prisma/client").$Enums.PaymentStatus;
                guideAmount: import("@prisma/client-runtime-utils").Decimal;
                id: string;
                createdAt: Date;
            } | null;
            slot: {
                startTime: Date;
                endTime: Date;
            };
            review: {
                id: string;
                rating: number;
                body: string | null;
            } | null;
        } & {
            status: import(".prisma/client").$Enums.BookingStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            seekerId: string;
            totalAmount: import("@prisma/client-runtime-utils").Decimal;
            cancelledAt: Date | null;
            cancellationReason: string | null;
            notes: string | null;
            serviceId: string;
            slotId: string;
            cancelledBy: string | null;
            completedAt: Date | null;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        statusCounts: Record<string, number>;
    }>;
    getGuideRevenue(query: PaginationQueryDto): Promise<{
        guides: {
            guideId: string;
            displayName: string;
            firstName: string;
            lastName: string;
            email: string;
            avatarUrl: string | null;
            serviceBookings: number;
            serviceRevenue: number;
            servicePlatformFee: number;
            tourBookings: number;
            tourRevenue: number;
            tourPlatformFee: number;
            totalRevenue: number;
            totalPlatformFee: number;
        }[];
        totals: {
            serviceRevenue: number;
            servicePlatformFee: number;
            serviceGuideAmount: number;
            tourRevenue: number;
            tourPlatformFee: number;
            tourGuideAmount: number;
        };
        total: number;
        page: number;
        limit: number;
        totalPages: number;
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
            amount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
            status: import(".prisma/client").$Enums.PaymentStatus;
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
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
export {};
