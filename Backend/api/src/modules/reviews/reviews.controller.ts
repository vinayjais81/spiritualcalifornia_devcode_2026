import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('guide/:userId')
  @ApiOperation({ summary: 'Get reviews for a guide by their user ID (public)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Reviews with rating distribution' })
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

  @Public()
  @Get('testimonials/:guideId')
  @ApiOperation({ summary: 'Get testimonials for a guide by their guide profile ID (public)' })
  findTestimonials(@Param('guideId') guideId: string) {
    return this.reviewsService.findTestimonialsByGuideId(guideId);
  }
}
