import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, ReviewTarget } from '@prisma/client';
import { CreateReviewDto, ReviewTargetType } from './dto/create-review.dto';

type EligibilityResult = {
  eligible: boolean;
  reason: string | null;
  targetType: ReviewTarget;
  transactionId: string;
  targetEntityId: string | null;
  targetEntityName: string | null;
  guideUserId: string | null;
  guideName: string | null;
  alreadyReviewed: boolean;
};

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Eligibility (polymorphic) ────────────────────────────────────────────

  async checkEligibility(
    userId: string,
    targetType: ReviewTargetType,
    transactionId: string,
  ): Promise<EligibilityResult> {
    const base = {
      targetType: targetType as unknown as ReviewTarget,
      transactionId,
      targetEntityId: null as string | null,
      targetEntityName: null as string | null,
      guideUserId: null as string | null,
      guideName: null as string | null,
      alreadyReviewed: false,
    };

    if (targetType === ReviewTargetType.SERVICE) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: transactionId },
        include: {
          seeker: { select: { userId: true } },
          service: { select: { id: true, name: true, guide: { select: { userId: true, displayName: true } } } },
          review: { select: { id: true } },
        },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.seeker.userId !== userId) throw new ForbiddenException('Not your booking');
      const reviewed = !!booking.review;
      const completed = booking.status === 'COMPLETED';
      return {
        ...base,
        targetEntityId: booking.service.id,
        targetEntityName: booking.service.name,
        guideUserId: booking.service.guide.userId,
        guideName: booking.service.guide.displayName,
        alreadyReviewed: reviewed,
        eligible: completed && !reviewed,
        reason: reviewed
          ? 'Already reviewed'
          : !completed
            ? `Booking status is ${booking.status} — must be COMPLETED`
            : null,
      };
    }

    if (targetType === ReviewTargetType.EVENT) {
      const ticket = await this.prisma.ticketPurchase.findUnique({
        where: { id: transactionId },
        include: {
          seeker: { select: { userId: true } },
          tier: {
            select: {
              event: { select: { id: true, title: true, endTime: true, guide: { select: { userId: true, displayName: true } } } },
            },
          },
          review: { select: { id: true } },
        },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (ticket.seeker.userId !== userId) throw new ForbiddenException('Not your ticket');
      const reviewed = !!ticket.review;
      const eventEnded = ticket.tier.event.endTime.getTime() < Date.now();
      const confirmed = ticket.status === 'CONFIRMED';
      return {
        ...base,
        targetEntityId: ticket.tier.event.id,
        targetEntityName: ticket.tier.event.title,
        guideUserId: ticket.tier.event.guide.userId,
        guideName: ticket.tier.event.guide.displayName,
        alreadyReviewed: reviewed,
        eligible: confirmed && eventEnded && !reviewed,
        reason: reviewed
          ? 'Already reviewed'
          : !confirmed
            ? `Ticket status is ${ticket.status} — must be CONFIRMED`
            : !eventEnded
              ? 'Event has not finished yet'
              : null,
      };
    }

    if (targetType === ReviewTargetType.TOUR) {
      const tourBooking = await this.prisma.tourBooking.findUnique({
        where: { id: transactionId },
        include: {
          seeker: { select: { userId: true } },
          tour: { select: { id: true, title: true, guide: { select: { userId: true, displayName: true } } } },
          review: { select: { id: true } },
        },
      });
      if (!tourBooking) throw new NotFoundException('Tour booking not found');
      if (tourBooking.seeker.userId !== userId) throw new ForbiddenException('Not your booking');
      const reviewed = !!tourBooking.review;
      const completed = tourBooking.status === 'COMPLETED';
      return {
        ...base,
        targetEntityId: tourBooking.tour.id,
        targetEntityName: tourBooking.tour.title,
        guideUserId: tourBooking.tour.guide.userId,
        guideName: tourBooking.tour.guide.displayName,
        alreadyReviewed: reviewed,
        eligible: completed && !reviewed,
        reason: reviewed
          ? 'Already reviewed'
          : !completed
            ? `Tour booking status is ${tourBooking.status} — must be COMPLETED`
            : null,
      };
    }

    if (targetType === ReviewTargetType.PRODUCT) {
      const orderItem = await this.prisma.orderItem.findUnique({
        where: { id: transactionId },
        include: {
          order: { select: { seeker: { select: { userId: true } }, status: true } },
          product: { select: { id: true, name: true, type: true, guide: { select: { userId: true, displayName: true } } } },
          review: { select: { id: true } },
        },
      });
      if (!orderItem) throw new NotFoundException('Order item not found');
      if (orderItem.order.seeker.userId !== userId) throw new ForbiddenException('Not your order');
      const reviewed = !!orderItem.review;
      // Digital: eligible once delivered (set at order PAID).
      // Physical: eligible once delivered (carrier confirmed or admin marked).
      const delivered = !!orderItem.deliveredAt;
      return {
        ...base,
        targetEntityId: orderItem.product.id,
        targetEntityName: orderItem.product.name,
        guideUserId: orderItem.product.guide.userId,
        guideName: orderItem.product.guide.displayName,
        alreadyReviewed: reviewed,
        eligible: delivered && !reviewed,
        reason: reviewed
          ? 'Already reviewed'
          : !delivered
            ? 'Item has not been delivered yet'
            : null,
      };
    }

    throw new BadRequestException('Unknown target type');
  }

  // ─── Create Review ────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateReviewDto) {
    const eligibility = await this.checkEligibility(userId, dto.targetType, dto.transactionId);
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason ?? 'Not eligible to review this purchase');
    }

    const targetType = dto.targetType as unknown as ReviewTarget;

    // Map dto.transactionId → the right per-source FK column (exactly one is set)
    const sourceFk: Partial<Prisma.ReviewCreateInput> = {};
    if (dto.targetType === ReviewTargetType.SERVICE) sourceFk.booking = { connect: { id: dto.transactionId } };
    if (dto.targetType === ReviewTargetType.EVENT) sourceFk.ticketPurchase = { connect: { id: dto.transactionId } };
    if (dto.targetType === ReviewTargetType.TOUR) sourceFk.tourBooking = { connect: { id: dto.transactionId } };
    if (dto.targetType === ReviewTargetType.PRODUCT) sourceFk.orderItem = { connect: { id: dto.transactionId } };

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          author: { connect: { id: userId } },
          guide: { connect: { id: eligibility.guideUserId! } },
          targetType,
          targetEntityId: eligibility.targetEntityId!,
          rating: dto.rating,
          title: dto.title,
          body: dto.body,
          ...sourceFk,
        },
        include: {
          author: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      });

      await this.recomputeAggregates(tx, targetType, eligibility.targetEntityId!, eligibility.guideUserId!);
      return created;
    });

    return review;
  }

  // ─── Aggregate recompute (per-entity + guide roll-up) ─────────────────────

  private async recomputeAggregates(
    tx: Prisma.TransactionClient,
    targetType: ReviewTarget,
    targetEntityId: string,
    guideUserId: string,
  ) {
    // Per-entity aggregate
    const entityAgg = await tx.review.aggregate({
      where: { targetType, targetEntityId, isApproved: true, isFlagged: false },
      _avg: { rating: true },
      _count: true,
    });
    const entityAvg = entityAgg._avg.rating ? Number(entityAgg._avg.rating.toFixed(2)) : 0;
    const entityCount = entityAgg._count;

    switch (targetType) {
      case 'SERVICE':
        await tx.service.update({
          where: { id: targetEntityId },
          data: { averageRating: entityAvg, reviewCount: entityCount },
        });
        break;
      case 'EVENT':
        await tx.event.update({
          where: { id: targetEntityId },
          data: { averageRating: entityAvg, reviewCount: entityCount },
        });
        break;
      case 'TOUR':
        await tx.soulTour.update({
          where: { id: targetEntityId },
          data: { averageRating: entityAvg, reviewCount: entityCount },
        });
        break;
      case 'PRODUCT':
        await tx.product.update({
          where: { id: targetEntityId },
          data: { averageRating: entityAvg, reviewCount: entityCount },
        });
        break;
    }

    // Guide-level roll-up across all offerings
    const guideAgg = await tx.review.aggregate({
      where: { guideId: guideUserId, isApproved: true, isFlagged: false },
      _avg: { rating: true },
      _count: true,
    });
    await tx.guideProfile.update({
      where: { userId: guideUserId },
      data: {
        averageRating: guideAgg._avg.rating ? Number(guideAgg._avg.rating.toFixed(2)) : 0,
        totalReviews: guideAgg._count,
      },
    });
  }

  // ─── List Seeker's Reviews ─────────────────────────────────────────────────

  async findMyReviews(userId: string) {
    return this.prisma.review.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        guide: { select: { firstName: true, lastName: true, avatarUrl: true, guideProfile: { select: { slug: true, displayName: true } } } },
      },
    });
  }

  // ─── Reviewable Purchases (services + events + tours + products) ──────────

  async getReviewable(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) return { services: [], events: [], tours: [], products: [] };

    const [services, events, tours, products] = await Promise.all([
      this.prisma.booking.findMany({
        where: { seekerId: seeker.id, status: 'COMPLETED', review: null },
        include: {
          service: {
            select: { id: true, name: true, guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } } },
          },
          slot: { select: { startTime: true } },
        },
        orderBy: { completedAt: 'desc' },
      }),
      this.prisma.ticketPurchase.findMany({
        where: {
          seekerId: seeker.id,
          status: 'CONFIRMED',
          review: null,
          tier: { event: { endTime: { lt: new Date() } } },
        },
        include: {
          tier: {
            select: {
              event: {
                select: {
                  id: true,
                  title: true,
                  endTime: true,
                  coverImageUrl: true,
                  guide: { select: { displayName: true, slug: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tourBooking.findMany({
        where: { seekerId: seeker.id, status: 'COMPLETED', review: null },
        include: {
          tour: {
            select: { id: true, title: true, slug: true, coverImageUrl: true, guide: { select: { displayName: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: { seeker: { id: seeker.id } },
          deliveredAt: { not: null },
          review: null,
        },
        include: {
          product: {
            select: { id: true, name: true, imageUrls: true, guide: { select: { displayName: true } } },
          },
        },
        orderBy: { deliveredAt: 'desc' },
      }),
    ]);

    return { services, events, tours, products };
  }

  // ─── Public: Reviews for an entity (Service / Event / Tour / Product) ─────

  async findForEntity(targetType: ReviewTargetType, targetEntityId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const tt = targetType as unknown as ReviewTarget;
    const where: Prisma.ReviewWhereInput = {
      targetType: tt,
      targetEntityId,
      isApproved: true,
      isFlagged: false,
    };

    const [reviews, total, distribution, agg] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: true }),
      this.prisma.review.aggregate({ where, _avg: { rating: true } }),
    ]);

    const ratingBars: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach((d) => {
      ratingBars[d.rating] = d._count;
    });

    return {
      reviews,
      averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : 0,
      totalReviews: total,
      ratingDistribution: ratingBars,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Public: All Reviews for a Guide (cross-offering) ─────────────────────

  async findByGuideUserId(guideUserId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: Prisma.ReviewWhereInput = {
      guideId: guideUserId,
      isApproved: true,
      isFlagged: false,
    };

    const [reviews, total, distribution] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: true }),
    ]);

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

  // ─── Guide dashboard: own reviews, optionally filtered by offering type ───

  async findReceivedByGuide(guideUserId: string, targetType?: ReviewTargetType) {
    const where: Prisma.ReviewWhereInput = { guideId: guideUserId };
    if (targetType) where.targetType = targetType as unknown as ReviewTarget;
    return this.prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  // ─── Testimonials (unchanged — guide-managed, no transaction required) ────

  async findTestimonialsByGuideId(guideId: string) {
    return this.prisma.testimonial.findMany({
      where: { targetGuideId: guideId, isApproved: true },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  // ─── Admin: Flag / Moderate ───────────────────────────────────────────────

  async flagReview(reviewId: string, flag: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({ where: { id: reviewId }, data: { isFlagged: flag } });
      await this.recomputeAggregates(tx, updated.targetType, updated.targetEntityId, updated.guideId);
      return updated;
    });
  }

  async moderateReview(reviewId: string, approved: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({ where: { id: reviewId }, data: { isApproved: approved } });
      await this.recomputeAggregates(tx, updated.targetType, updated.targetEntityId, updated.guideId);
      return updated;
    });
  }

  // ─── Rating Summary helper ────────────────────────────────────────────────

  async getRatingSummary(guideUserId: string) {
    const result = await this.prisma.review.aggregate({
      where: { guideId: guideUserId, isApproved: true, isFlagged: false },
      _avg: { rating: true },
      _count: true,
    });
    return {
      averageRating: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : 0,
      totalReviews: result._count,
    };
  }
}
