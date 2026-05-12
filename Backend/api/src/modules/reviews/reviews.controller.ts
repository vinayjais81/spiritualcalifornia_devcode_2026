import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReviewTargetType } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ─── Create Review (Seeker, post-purchase) ─────────────────────────────────

  @Post()
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Submit a review for a completed purchase (service / event / tour / product)' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }

  // ─── Eligibility (polymorphic) ─────────────────────────────────────────────

  @Get('eligibility')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Check whether a purchase is reviewable' })
  @ApiQuery({ name: 'targetType', enum: ReviewTargetType })
  @ApiQuery({ name: 'transactionId', type: String })
  checkEligibility(
    @CurrentUser() user: CurrentUserData,
    @Query('targetType') targetType: ReviewTargetType,
    @Query('transactionId') transactionId: string,
  ) {
    if (!targetType || !transactionId) {
      throw new BadRequestException('targetType and transactionId are required');
    }
    return this.reviewsService.checkEligibility(user.id, targetType, transactionId);
  }

  // Legacy alias: /reviews/eligibility/:bookingId  →  service-booking eligibility.
  // Kept so older review emails / browser tabs don't 404 after the v2 rollout.
  @Get('eligibility/:bookingId')
  @Roles(Role.SEEKER)
  checkEligibilityLegacy(@CurrentUser() user: CurrentUserData, @Param('bookingId') bookingId: string) {
    return this.reviewsService.checkEligibility(user.id, ReviewTargetType.SERVICE, bookingId);
  }

  // ─── My Reviews ────────────────────────────────────────────────────────────

  @Get('mine')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "List seeker's submitted reviews" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.reviewsService.findMyReviews(user.id);
  }

  // ─── Reviewable Purchases (all types) ──────────────────────────────────────

  @Get('reviewable')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'List completed purchases (services + events + tours + products) awaiting review' })
  getReviewable(@CurrentUser() user: CurrentUserData) {
    return this.reviewsService.getReviewable(user.id);
  }

  // ─── Public: Reviews for a single offering ─────────────────────────────────

  @Public()
  @Get('for')
  @ApiOperation({ summary: 'Get reviews for a single offering (service / event / tour / product)' })
  @ApiQuery({ name: 'targetType', enum: ReviewTargetType })
  @ApiQuery({ name: 'targetEntityId', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findForEntity(
    @Query('targetType') targetType: ReviewTargetType,
    @Query('targetEntityId') targetEntityId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!targetType || !targetEntityId) {
      throw new BadRequestException('targetType and targetEntityId are required');
    }
    return this.reviewsService.findForEntity(
      targetType,
      targetEntityId,
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 50) : 10,
    );
  }

  // ─── Public: Reviews for a Guide (cross-offering) ──────────────────────────

  @Public()
  @Get('guide/:userId')
  @ApiOperation({ summary: 'Get all reviews for a guide across all their offerings (public)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findByGuide(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.findByGuideUserId(
      userId,
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 50) : 10,
    );
  }

  // ─── Guide dashboard: reviews received, filterable by offering type ────────

  @Get('received')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Reviews received by the current guide, optionally filtered by offering type' })
  @ApiQuery({ name: 'targetType', required: false, enum: ReviewTargetType })
  findReceived(@CurrentUser() user: CurrentUserData, @Query('targetType') targetType?: ReviewTargetType) {
    return this.reviewsService.findReceivedByGuide(user.id, targetType);
  }

  // ─── Public: Testimonials (unchanged) ──────────────────────────────────────

  @Public()
  @Get('testimonials/:guideId')
  @ApiOperation({ summary: 'Get testimonials for a guide' })
  findTestimonials(@Param('guideId') guideId: string) {
    return this.reviewsService.findTestimonialsByGuideId(guideId);
  }

  // ─── Admin: Moderate Reviews ───────────────────────────────────────────────

  @Patch(':id/flag')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Flag or unflag a review' })
  flag(@Param('id') id: string, @Body('flag') flag: boolean) {
    return this.reviewsService.flagReview(id, flag);
  }

  @Patch(':id/moderate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or reject a review' })
  moderate(@Param('id') id: string, @Body('approved') approved: boolean) {
    return this.reviewsService.moderateReview(id, approved);
  }
}
