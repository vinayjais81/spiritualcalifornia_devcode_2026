import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
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

  // ─── Create Review (Seeker, post-booking) ──────────────────────────────────

  @Post()
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Submit a review for a completed booking' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }

  // ─── Check Eligibility ─────────────────────────────────────────────────────

  @Get('eligibility/:bookingId')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Check if a booking is eligible for review' })
  checkEligibility(@CurrentUser() user: CurrentUserData, @Param('bookingId') bookingId: string) {
    return this.reviewsService.checkEligibility(user.id, bookingId);
  }

  // ─── My Reviews ────────────────────────────────────────────────────────────

  @Get('mine')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "List seeker's submitted reviews" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.reviewsService.findMyReviews(user.id);
  }

  // ─── Reviewable Bookings ───────────────────────────────────────────────────

  @Get('reviewable')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'List completed bookings that can be reviewed' })
  getReviewable(@CurrentUser() user: CurrentUserData) {
    return this.reviewsService.getReviewableBookings(user.id);
  }

  // ─── Public: Get Reviews for a Guide ───────────────────────────────────────

  @Public()
  @Get('guide/:userId')
  @ApiOperation({ summary: 'Get reviews for a guide by their user ID (public)' })
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

  // ─── Public: Get Testimonials ──────────────────────────────────────────────

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
