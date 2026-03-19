import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
export declare class VerificationService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    private queue;
    private worker;
    private readonly isPersonaStub;
    private readonly isTextractStub;
    private readonly isClaudeStub;
    private readonly isRedisStub;
    private readonly personaApiKey;
    private readonly personaTemplateId;
    private readonly redisHost;
    private readonly redisPort;
    private readonly redisPassword;
    constructor(prisma: PrismaService, config: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    enqueueGuideVerification(guideId: string): Promise<void>;
    private processVerificationJob;
    private runStubPipeline;
    private analyzeWithTextract;
    private extractEntitiesWithClaude;
    private initiatePersonaCheck;
    startIdentityVerification(userId: string): Promise<{
        inquiryId: string;
        sessionToken: string | null;
        verifyUrl: string | null;
        stub: boolean;
    }>;
    handlePersonaWebhook(payload: {
        inquiryId: string;
        status: 'approved' | 'declined' | 'needs_review';
    }): Promise<void>;
    reviewGuide(guideId: string, decision: 'approve' | 'reject', adminNotes?: string): Promise<void>;
    private sendVerificationStatusEmail;
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
    })[]>;
}
