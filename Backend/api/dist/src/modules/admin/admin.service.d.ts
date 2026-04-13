import { PrismaService } from '../../database/prisma.service';
import { Role, VerificationStatus, BookingStatus, TourBookingStatus } from '@prisma/client';
export declare class AdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDashboardStats(): Promise<{
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
    getUsers(params: {
        page: number;
        limit: number;
        search?: string;
    }): Promise<{
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
    getUserDetail(userId: string): Promise<{
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
            userId: string;
            role: import(".prisma/client").$Enums.Role;
        }[];
    } | null>;
    getGuides(params: {
        page: number;
        limit: number;
        search?: string;
        status?: VerificationStatus;
    }): Promise<{
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
    getVerificationQueue(params: {
        page: number;
        limit: number;
    }): Promise<{
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
    rejectGuide(guideId: string, reason: string): Promise<{
        verificationStatus: import(".prisma/client").$Enums.VerificationStatus;
        id: string;
    }>;
    getTourBookings(params: {
        page: number;
        limit: number;
        search?: string;
        status?: TourBookingStatus;
        guideId?: string;
    }): Promise<{
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
    getServiceBookings(params: {
        page: number;
        limit: number;
        search?: string;
        status?: BookingStatus;
        guideId?: string;
    }): Promise<{
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
    getGuideRevenue(params: {
        page: number;
        limit: number;
        search?: string;
    }): Promise<{
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
