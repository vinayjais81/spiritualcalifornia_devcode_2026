"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GuidesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuidesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const upload_service_1 = require("../upload/upload.service");
const services_service_1 = require("../services/services.service");
const events_service_1 = require("../events/events.service");
const products_service_1 = require("../products/products.service");
const reviews_service_1 = require("../reviews/reviews.service");
const blog_service_1 = require("../blog/blog.service");
const client_1 = require("@prisma/client");
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
let GuidesService = GuidesService_1 = class GuidesService {
    prisma;
    uploadService;
    servicesService;
    eventsService;
    productsService;
    reviewsService;
    blogService;
    logger = new common_1.Logger(GuidesService_1.name);
    constructor(prisma, uploadService, servicesService, eventsService, productsService, reviewsService, blogService) {
        this.prisma = prisma;
        this.uploadService = uploadService;
        this.servicesService = servicesService;
        this.eventsService = eventsService;
        this.productsService = productsService;
        this.reviewsService = reviewsService;
        this.blogService = blogService;
    }
    async listCategories() {
        return this.prisma.category.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                subcategories: {
                    where: { isApproved: true },
                    orderBy: { name: 'asc' },
                },
            },
        });
    }
    async startOnboarding(userId) {
        const existing = await this.prisma.guideProfile.findUnique({ where: { userId } });
        if (existing)
            return existing;
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { firstName: true, lastName: true },
        });
        const baseSlug = slugify(`${user.firstName} ${user.lastName}`);
        const slug = await this.ensureUniqueSlug(baseSlug);
        const [guideProfile] = await Promise.all([
            this.prisma.guideProfile.create({
                data: {
                    userId,
                    slug,
                    displayName: `${user.firstName} ${user.lastName}`,
                    verificationStatus: client_1.VerificationStatus.PENDING,
                },
            }),
            this.prisma.userRole.upsert({
                where: { userId_role: { userId, role: client_1.Role.GUIDE } },
                create: { userId, role: client_1.Role.GUIDE },
                update: {},
            }),
        ]);
        this.logger.log(`Guide onboarding started: user=${userId} profile=${guideProfile.id}`);
        return guideProfile;
    }
    async updateProfile(userId, dto) {
        const guide = await this.findGuideByUserId(userId);
        const profileData = {};
        const fields = ['displayName', 'tagline', 'bio', 'location', 'studioName',
            'streetAddress', 'city', 'state', 'zipCode', 'country', 'timezone',
            'websiteUrl', 'instagramUrl', 'youtubeUrl', 'yearsExperience'];
        for (const f of fields) {
            if (dto[f] !== undefined)
                profileData[f] = dto[f];
        }
        if (dto.languages !== undefined)
            profileData['languages'] = dto.languages;
        if (dto.modalities !== undefined)
            profileData['modalities'] = dto.modalities;
        const userPatch = {};
        if (dto.avatarS3Key)
            userPatch['avatarUrl'] = this.uploadService.getFileUrl(dto.avatarS3Key);
        if (dto.phone !== undefined)
            userPatch['phone'] = dto.phone;
        if (Object.keys(userPatch).length > 0) {
            await this.prisma.user.update({ where: { id: userId }, data: userPatch });
        }
        return this.prisma.guideProfile.update({ where: { id: guide.id }, data: profileData });
    }
    async setCategories(userId, dto) {
        const guide = await this.findGuideByUserId(userId);
        await this.prisma.guideCategory.deleteMany({ where: { guideId: guide.id } });
        for (const selection of dto.categories) {
            const category = await this.prisma.category.findUnique({ where: { id: selection.categoryId } });
            if (!category)
                throw new common_1.NotFoundException(`Category ${selection.categoryId} not found`);
            const customSubIds = [];
            for (const name of selection.customSubcategoryNames ?? []) {
                const slug = slugify(name);
                const sub = await this.prisma.subcategory.upsert({
                    where: { categoryId_slug: { categoryId: selection.categoryId, slug } },
                    create: { categoryId: selection.categoryId, name, slug, isCustom: true, isApproved: false },
                    update: {},
                });
                customSubIds.push(sub.id);
            }
            const allSubIds = [...(selection.subcategoryIds ?? []), ...customSubIds];
            if (allSubIds.length > 0) {
                for (const subcategoryId of allSubIds) {
                    await this.prisma.guideCategory.create({
                        data: { guideId: guide.id, categoryId: selection.categoryId, subcategoryId },
                    });
                }
            }
            else {
                await this.prisma.guideCategory.create({
                    data: { guideId: guide.id, categoryId: selection.categoryId },
                });
            }
        }
        const profilePatch = {};
        if (dto.modalities !== undefined)
            profilePatch['modalities'] = dto.modalities;
        if (dto.issuesHelped !== undefined)
            profilePatch['issuesHelped'] = dto.issuesHelped;
        if (Object.keys(profilePatch).length > 0) {
            await this.prisma.guideProfile.update({ where: { id: guide.id }, data: profilePatch });
        }
        return this.prisma.guideProfile.findUnique({
            where: { id: guide.id },
            include: { categories: { include: { category: true, subcategory: true } } },
        });
    }
    async addCredential(userId, dto) {
        const guide = await this.findGuideByUserId(userId);
        const documentUrl = dto.documentS3Key
            ? this.uploadService.getFileUrl(dto.documentS3Key)
            : undefined;
        return this.prisma.credential.create({
            data: {
                guideId: guide.id,
                title: dto.title,
                institution: dto.institution,
                issuedYear: dto.issuedYear,
                documentUrl,
                verificationStatus: client_1.VerificationStatus.PENDING,
            },
        });
    }
    async deleteCredential(userId, credentialId) {
        const guide = await this.findGuideByUserId(userId);
        const credential = await this.prisma.credential.findUnique({ where: { id: credentialId } });
        if (!credential || credential.guideId !== guide.id) {
            throw new common_1.ForbiddenException('Credential not found');
        }
        await this.prisma.credential.delete({ where: { id: credentialId } });
        return { deleted: true };
    }
    async saveCalendarSettings(userId, dto) {
        const guide = await this.findGuideByUserId(userId);
        const data = {};
        if (dto.calendarType !== undefined)
            data['calendarType'] = dto.calendarType;
        if (dto.calendarLink !== undefined)
            data['calendarLink'] = dto.calendarLink;
        if (dto.sessionPricingJson !== undefined)
            data['sessionPricingJson'] = dto.sessionPricingJson;
        if (dto.calendarType === null || dto.calendarLink === null) {
            data['calendlyConnected'] = false;
            data['calendlyAccessToken'] = null;
            data['calendlyRefreshToken'] = null;
            data['calendlyUserUri'] = null;
        }
        return this.prisma.guideProfile.update({ where: { id: guide.id }, data });
    }
    async saveCalendlyTokens(userId, tokens) {
        const guide = await this.findGuideByUserId(userId);
        return this.prisma.guideProfile.update({
            where: { id: guide.id },
            data: {
                calendarType: 'Calendly',
                calendlyConnected: true,
                calendlyAccessToken: tokens.accessToken,
                calendlyRefreshToken: tokens.refreshToken,
                calendlyUserUri: tokens.userUri,
            },
        });
    }
    async submitOnboarding(userId) {
        const guide = await this.findGuideByUserId(userId, true);
        if (guide.verificationStatus === client_1.VerificationStatus.IN_REVIEW) {
            throw new common_1.ConflictException('Already submitted and under review');
        }
        if (guide.verificationStatus === client_1.VerificationStatus.APPROVED) {
            throw new common_1.ConflictException('Guide is already verified');
        }
        const guideWithRelations = guide;
        if (!guideWithRelations.bio && !guideWithRelations.tagline) {
            throw new common_1.BadRequestException('Profile bio or tagline required before submitting');
        }
        if (!guideWithRelations.categories.length) {
            throw new common_1.BadRequestException('At least one category required before submitting');
        }
        const updated = await this.prisma.guideProfile.update({
            where: { id: guide.id },
            data: { verificationStatus: client_1.VerificationStatus.IN_REVIEW },
        });
        this.logger.log(`Guide ${guide.id} submitted for verification`);
        return updated;
    }
    async getOnboardingStatus(userId) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { userId },
            include: { categories: true, credentials: true },
        });
        if (!guide)
            return { started: false };
        return {
            started: true,
            guideId: guide.id,
            displayName: guide.displayName,
            verificationStatus: guide.verificationStatus,
            isPublished: guide.isPublished,
            isVerified: guide.isVerified,
            categoriesSet: guide.categories.length > 0,
            credentialsCount: guide.credentials.length,
            completedSteps: this.resolveCompletedSteps(guide),
        };
    }
    async getMyProfile(userId) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { userId },
            include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true, phone: true } },
                categories: {
                    include: {
                        category: { select: { id: true, name: true, slug: true } },
                        subcategory: { select: { id: true, name: true } },
                    },
                },
                credentials: true,
            },
        });
        if (!guide)
            throw new common_1.NotFoundException('Guide profile not found — start onboarding first');
        const personaVerification = await this.prisma.personaVerification.findUnique({
            where: { userId },
            select: { status: true, completedAt: true },
        });
        return {
            id: guide.id,
            slug: guide.slug,
            displayName: guide.displayName,
            tagline: guide.tagline,
            bio: guide.bio,
            location: guide.location,
            studioName: guide.studioName,
            streetAddress: guide.streetAddress,
            city: guide.city,
            state: guide.state,
            zipCode: guide.zipCode,
            country: guide.country,
            timezone: guide.timezone,
            languages: guide.languages,
            modalities: guide.modalities,
            issuesHelped: guide.issuesHelped,
            yearsExperience: guide.yearsExperience,
            websiteUrl: guide.websiteUrl,
            instagramUrl: guide.instagramUrl,
            youtubeUrl: guide.youtubeUrl,
            calendarType: guide.calendarType,
            calendarLink: guide.calendarLink,
            calendlyConnected: guide.calendlyConnected,
            sessionPricingJson: guide.sessionPricingJson,
            isPublished: guide.isPublished,
            isVerified: guide.isVerified,
            verificationStatus: guide.verificationStatus,
            avatarUrl: guide.user.avatarUrl,
            phone: guide.user.phone,
            firstName: guide.user.firstName,
            lastName: guide.user.lastName,
            categories: guide.categories,
            credentials: guide.credentials,
            identityVerification: personaVerification
                ? { status: personaVerification.status, completedAt: personaVerification.completedAt }
                : null,
        };
    }
    async findGuideByUserId(userId, includeRelations = false) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { userId },
            include: includeRelations ? { categories: true, credentials: true } : undefined,
        });
        if (!guide)
            throw new common_1.NotFoundException('Guide profile not found — start onboarding first');
        return guide;
    }
    resolveCompletedSteps(guide) {
        const steps = [0];
        if (guide.categories.length > 0)
            steps.push(1);
        if (guide.bio || guide.tagline || guide.displayName)
            steps.push(2);
        if (guide.credentials.length > 0)
            steps.push(3);
        if ([client_1.VerificationStatus.IN_REVIEW, client_1.VerificationStatus.APPROVED].includes(guide.verificationStatus)) {
            steps.push(4);
        }
        return steps;
    }
    async getPublicProfile(slug) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { slug },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                        createdAt: true,
                    },
                },
                categories: {
                    include: {
                        category: { select: { id: true, name: true, slug: true } },
                        subcategory: { select: { id: true, name: true } },
                    },
                },
                credentials: {
                    select: {
                        id: true,
                        title: true,
                        institution: true,
                        issuedYear: true,
                        verificationStatus: true,
                        verifiedAt: true,
                    },
                },
            },
        });
        if (!guide)
            throw new common_1.NotFoundException(`Guide not found: ${slug}`);
        const [services, events, products, blogPosts, reviewData, testimonials] = await Promise.all([
            this.servicesService.findByGuideId(guide.id),
            this.eventsService.findPublishedByGuideId(guide.id),
            this.productsService.findActiveByGuideId(guide.id),
            this.blogService.findPublishedByGuideId(guide.id),
            this.reviewsService.findByGuideUserId(guide.userId, 1, 5),
            this.reviewsService.findTestimonialsByGuideId(guide.id),
        ]);
        const tags = guide.categories.map((gc) => ({
            category: gc.category.name,
            categorySlug: gc.category.slug,
            subcategory: gc.subcategory?.name ?? null,
        }));
        const verifiedCredentials = guide.credentials.filter((c) => c.verificationStatus === 'APPROVED' || c.verifiedAt);
        return {
            id: guide.id,
            userId: guide.userId,
            slug: guide.slug,
            displayName: guide.displayName,
            tagline: guide.tagline,
            bio: guide.bio,
            location: guide.location,
            timezone: guide.timezone,
            languages: guide.languages,
            avatarUrl: guide.user.avatarUrl,
            websiteUrl: guide.websiteUrl,
            instagramUrl: guide.instagramUrl,
            youtubeUrl: guide.youtubeUrl,
            calendarType: guide.calendarType,
            calendarLink: guide.calendarLink,
            sessionPricingJson: guide.sessionPricingJson,
            verificationStatus: guide.verificationStatus,
            isVerified: guide.isVerified,
            tags,
            credentials: verifiedCredentials,
            services,
            events,
            products,
            blogPosts,
            reviews: reviewData.reviews,
            reviewStats: {
                averageRating: guide.averageRating,
                totalReviews: guide.totalReviews,
                ratingDistribution: reviewData.ratingDistribution,
            },
            testimonials,
            memberSince: guide.user.createdAt,
        };
    }
    async ensureUniqueSlug(base) {
        let slug = base;
        let attempt = 0;
        while (true) {
            const exists = await this.prisma.guideProfile.findUnique({ where: { slug } });
            if (!exists)
                return slug;
            slug = `${base}-${++attempt}`;
        }
    }
};
exports.GuidesService = GuidesService;
exports.GuidesService = GuidesService = GuidesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        upload_service_1.UploadService,
        services_service_1.ServicesService,
        events_service_1.EventsService,
        products_service_1.ProductsService,
        reviews_service_1.ReviewsService,
        blog_service_1.BlogService])
], GuidesService);
//# sourceMappingURL=guides.service.js.map