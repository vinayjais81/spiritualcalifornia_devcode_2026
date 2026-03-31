import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Check if User Can Review a Booking ────────────────────────────────────

  async checkEligibility(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        seeker: { select: { userId: true } },
        service: { select: { guide: { select: { userId: true, displayName: true } } } },
        review: { select: { id: true } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.seeker.userId !== userId) throw new ForbiddenException('Not your booking');

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

  // ─── Create Review ─────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        seeker: { select: { userId: true } },
        service: { select: { guide: { select: { userId: true, id: true } } } },
        review: { select: { id: true } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.seeker.userId !== userId) throw new ForbiddenException('Not your booking');
    if (booking.status !== 'COMPLETED') throw new BadRequestException('Can only review completed sessions');
    if (booking.review) throw new BadRequestException('This booking has already been reviewed');

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

    // Update guide aggregate rating
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

  // ─── List Seeker's Reviews ─────────────────────────────────────────────────

  async findMyReviews(userId: string) {
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

  // ─── Get Reviewable Bookings (completed, not yet reviewed) ─────────────────

  async getReviewableBookings(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) return [];

    return this.prisma.booking.findMany({
      where: {
        seekerId: seeker.id,
        status: 'COMPLETED',
        review: null, // No review yet
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

  // ─── Admin: Flag / Unflag Review ───────────────────────────────────────────

  async flagReview(reviewId: string, flag: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isFlagged: flag },
    });
  }

  // ─── Admin: Approve / Reject Review ────────────────────────────────────────

  async moderateReview(reviewId: string, approved: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: approved },
    });
  }

  // ─── Get Reviews for a Guide (Public) ──────────────────────────────────────

  async findByGuideUserId(guideUserId: string, page = 1, limit = 10) {
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

    // Rating distribution
    const distribution = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { targetId: guideUserId, isApproved: true, isFlagged: false },
      _count: true,
    });

    const ratingBars: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach((d) => {
      ratingBars[d.rating] = d._count;
    });

    return {
      reviews,
      ratingDistribution: ratingBars,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Get Testimonials for a Guide (Public) ─────────────────────────────────

  async findTestimonialsByGuideId(guideId: string) {
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

  // ─── Get Rating Summary for a Guide ────────────────────────────────────────

  async getRatingSummary(guideUserId: string) {
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
}
