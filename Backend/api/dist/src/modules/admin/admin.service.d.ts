import { PrismaService } from '../../database/prisma.service';
import { Role, VerificationStatus, BookingStatus, TourBookingStatus, PayoutStatus } from '@prisma/client';
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
    getTourBookings(params: {
        page: number;
        limit: number;
        search?: string;
        status?: TourBookingStatus;
        guideId?: string;
    }): Promise<{
        bookings: ({
            seeker: {
                user: {
                    email: string;
                    firstName: string;
                    lastName: string;
                    avatarUrl: string | null;
                };
            };
            tour: {
                id: string;
                slug: string;
                location: string | null;
                guide: {
                    id: string;
                    user: {
                        email: string;
                        firstName: string;
                        lastName: string;
                        avatarUrl: string | null;
                    };
                    displayName: string;
                };
                title: string;
            };
            departure: {
                status: import(".prisma/client").$Enums.DepartureStatus;
                startDate: Date;
                endDate: Date;
            } | null;
            payments: {
                id: string;
                createdAt: Date;
                status: import(".prisma/client").$Enums.PaymentStatus;
                amount: import("@prisma/client-runtime-utils").Decimal;
                platformFee: import("@prisma/client-runtime-utils").Decimal;
                guideAmount: import("@prisma/client-runtime-utils").Decimal;
                paymentType: import(".prisma/client").$Enums.PaymentType;
            }[];
            travelers_rel: {
                id: string;
                firstName: string;
                lastName: string;
                isPrimary: boolean;
                nationality: string;
            }[];
            roomType: {
                name: string;
                totalPrice: import("@prisma/client-runtime-utils").Decimal;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            status: import(".prisma/client").$Enums.TourBookingStatus;
            totalAmount: import("@prisma/client-runtime-utils").Decimal;
            cancelledAt: Date | null;
            cancellationReason: string | null;
            seekerId: string;
            paymentMethod: string | null;
            travelers: number;
            depositAmount: import("@prisma/client-runtime-utils").Decimal | null;
            chosenDepositAmount: import("@prisma/client-runtime-utils").Decimal | null;
            depositPaidAt: Date | null;
            balanceAmount: import("@prisma/client-runtime-utils").Decimal | null;
            balanceDueAt: Date | null;
            balanceReminderSentAt: Date | null;
            balancePaidAt: Date | null;
            holdExpiresAt: Date | null;
            bookingReference: string | null;
            dietaryRequirements: string | null;
            dietaryNotes: string | null;
            healthConditions: string | null;
            intentions: string | null;
            specialRequests: string | null;
            contactFirstName: string;
            contactLastName: string;
            contactEmail: string;
            contactPhone: string | null;
            tourId: string;
            departureId: string | null;
            roomTypeId: string;
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
                    id: string;
                    user: {
                        email: string;
                        firstName: string;
                        lastName: string;
                        avatarUrl: string | null;
                    };
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
            slot: {
                startTime: Date;
                endTime: Date;
            };
            payment: {
                id: string;
                createdAt: Date;
                status: import(".prisma/client").$Enums.PaymentStatus;
                amount: import("@prisma/client-runtime-utils").Decimal;
                platformFee: import("@prisma/client-runtime-utils").Decimal;
                guideAmount: import("@prisma/client-runtime-utils").Decimal;
            } | null;
            review: {
                id: string;
                rating: number;
                body: string | null;
            } | null;
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
    getPayoutRequests(params: {
        page: number;
        limit: number;
        status?: PayoutStatus;
    }): Promise<{
        requests: {
            id: string;
            amount: number;
            currency: string;
            status: import(".prisma/client").$Enums.PayoutStatus;
            stripePayoutId: string | null;
            processedAt: Date | null;
            createdAt: Date;
            guide: {
                id: string;
                displayName: string;
                name: string;
                email: string;
                avatarUrl: string | null;
                stripeConnected: boolean;
            };
            balance: {
                available: number;
                totalEarned: number;
                totalPaidOut: number;
            };
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        statusCounts: Record<string, number>;
    }>;
    getGuideBalances(params: {
        page: number;
        limit: number;
        search?: string;
    }): Promise<{
        accounts: {
            id: string;
            guideId: string;
            displayName: string;
            name: string;
            email: string;
            avatarUrl: string | null;
            stripeConnected: boolean;
            availableBalance: number;
            pendingBalance: number;
            totalEarned: number;
            totalPaidOut: number;
            payoutRequestsCount: number;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
