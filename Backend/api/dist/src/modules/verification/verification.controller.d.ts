import { ConfigService } from '@nestjs/config';
import { VerificationService } from './verification.service';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
export declare class VerificationController {
    private readonly verificationService;
    private readonly config;
    private readonly logger;
    constructor(verificationService: VerificationService, config: ConfigService);
    personaWebhook(req: RawBodyRequest<Request>, body: any, signatureHeader: string): Promise<{
        received: boolean;
    }>;
    startIdentityVerification(req: any): Promise<{
        inquiryId: string;
        sessionToken: string | null;
        verifyUrl: string | null;
        stub: boolean;
    }>;
    getPendingReviews(): Promise<({
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        };
        categories: ({
            category: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
                iconUrl: string | null;
                sortOrder: number;
                isActive: boolean;
                createdAt: Date;
            };
            subcategory: {
                id: string;
                name: string;
                slug: string;
                createdAt: Date;
                categoryId: string;
                isApproved: boolean;
                isCustom: boolean;
            } | null;
        } & {
            id: string;
            categoryId: string;
            guideId: string;
            subcategoryId: string | null;
        })[];
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
    })[]>;
    approveGuide(guideId: string, body: {
        notes?: string;
    }): Promise<{
        message: string;
    }>;
    rejectGuide(guideId: string, body: {
        notes?: string;
    }): Promise<{
        message: string;
    }>;
}
