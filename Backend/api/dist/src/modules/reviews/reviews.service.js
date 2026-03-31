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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let ReviewsService = class ReviewsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async checkEligibility(userId, bookingId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                seeker: { select: { userId: true } },
                service: { select: { guide: { select: { userId: true, displayName: true } } } },
                review: { select: { id: true } },
            },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.seeker.userId !== userId)
            throw new common_1.ForbiddenException('Not your booking');
        return {
            eligible: booking.status === 'COMPLETED' && !booking.review,
            reason: booking.review
                ? 'Already reviewed'
                : booking.status !== 'COMPLETED'
                    ? `Booking status is ${booking.status} — must be COMPLETED`
                    : null,
            booking: {
                id: booking.id,
                status: booking.status,
                guideName: booking.service.guide.displayName,
                guideUserId: booking.service.guide.userId,
                alreadyReviewed: !!booking.review,
            },
        };
    }
    async create(userId, dto) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: dto.bookingId },
            include: {
                seeker: { select: { userId: true } },
                service: { select: { guide: { select: { userId: true, id: true } } } },
                review: { select: { id: true } },
            },
        });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.seeker.userId !== userId)
            throw new common_1.ForbiddenException('Not your booking');
        if (booking.status !== 'COMPLETED')
            throw new common_1.BadRequestException('Can only review completed sessions');
        if (booking.review)
            throw new common_1.BadRequestException('This booking has already been reviewed');
        const guideUserId = booking.service.guide.userId;
        const review = await this.prisma.review.create({
            data: {
                authorId: userId,
                targetId: guideUserId,
                bookingId: dto.bookingId,
                rating: dto.rating,
                title: dto.title,
                body: dto.body,
            },
            include: {
                author: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
        });
        const agg = await this.prisma.review.aggregate({
            where: { targetId: guideUserId, isApproved: true, isFlagged: false },
            _avg: { rating: true },
            _count: true,
        });
        await this.prisma.guideProfile.update({
            where: { userId: guideUserId },
            data: {
                averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : 0,
                totalReviews: agg._count,
            },
        });
        return review;
    }
    async findMyReviews(userId) {
        return this.prisma.review.findMany({
            where: { authorId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                target: { select: { firstName: true, lastName: true, avatarUrl: true } },
                booking: {
                    select: {
                        service: { select: { name: true, guide: { select: { displayName: true, slug: true } } } },
                    },
                },
            },
        });
    }
    async getReviewableBookings(userId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            return [];
        return this.prisma.booking.findMany({
            where: {
                seekerId: seeker.id,
                status: 'COMPLETED',
                review: null,
            },
            include: {
                service: {
                    select: {
                        name: true,
                        guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } },
                    },
                },
                slot: { select: { startTime: true } },
            },
            orderBy: { completedAt: 'desc' },
        });
    }
    async flagReview(reviewId, flag) {
        const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        return this.prisma.review.update({
            where: { id: reviewId },
            data: { isFlagged: flag },
        });
    }
    async moderateReview(reviewId, approved) {
        const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        return this.prisma.review.update({
            where: { id: reviewId },
            data: { isApproved: approved },
        });
    }
    async findByGuideUserId(guideUserId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [reviews, total] = await Promise.all([
            this.prisma.review.findMany({
                where: { targetId: guideUserId, isApproved: true, isFlagged: false },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    author: {
                        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
                    },
                },
            }),
            this.prisma.review.count({
                where: { targetId: guideUserId, isApproved: true, isFlagged: false },
            }),
        ]);
        const distribution = await this.prisma.review.groupBy({
            by: ['rating'],
            where: { targetId: guideUserId, isApproved: true, isFlagged: false },
            _count: true,
        });
        const ratingBars = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        distribution.forEach((d) => {
            ratingBars[d.rating] = d._count;
        });
        return {
            reviews,
            ratingDistribution: ratingBars,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
    async findTestimonialsByGuideId(guideId) {
        return this.prisma.testimonial.findMany({
            where: { targetGuideId: guideId, isApproved: true },
            orderBy: { createdAt: 'desc' },
            include: {
                author: {
                    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
                },
            },
        });
    }
    async getRatingSummary(guideUserId) {
        const result = await this.prisma.review.aggregate({
            where: { targetId: guideUserId, isApproved: true, isFlagged: false },
            _avg: { rating: true },
            _count: true,
        });
        return {
            averageRating: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : 0,
            totalReviews: result._count,
        };
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map