import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

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
