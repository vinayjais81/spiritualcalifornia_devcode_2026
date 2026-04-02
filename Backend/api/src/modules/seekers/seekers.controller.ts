import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { SeekersService } from './seekers.service';

@ApiTags('Seekers')
@Controller('seekers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SeekersController {
  constructor(private readonly seekersService: SeekersService) {}

  // ─── Onboarding ────────────────────────────────────────────────────────────

  @Get('onboarding/status')
  @ApiOperation({ summary: 'Get seeker onboarding completion status' })
  getStatus(@CurrentUser() user: CurrentUserData) {
    return this.seekersService.getOnboardingStatus(user.id);
  }

  @Patch('onboarding/step')
  @ApiOperation({ summary: 'Save seeker onboarding progress' })
  updateStep(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { step: number; completed?: boolean },
  ) {
    return this.seekersService.updateOnboardingStep(user.id, body.step, body.completed ?? false);
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('me')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "Get seeker's own profile" })
  getMyProfile(@CurrentUser() user: CurrentUserData) {
    return this.seekersService.getMyProfile(user.id);
  }

  @Patch('me')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Update seeker profile' })
  updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: { bio?: string; location?: string; timezone?: string; interests?: string[] },
  ) {
    return this.seekersService.updateProfile(user.id, dto);
  }

  @Get('dashboard/stats')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Get seeker dashboard stats' })
  getDashboardStats(@CurrentUser() user: CurrentUserData) {
    return this.seekersService.getDashboardStats(user.id);
  }

  // ─── Payment History ───────────────────────────────────────────────────────

  @Get('payments')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "Get seeker's payment history" })
  getPaymentHistory(@CurrentUser() user: CurrentUserData) {
    return this.seekersService.getPaymentHistory(user.id);
  }

  // ─── Favorites ─────────────────────────────────────────────────────────────

  @Get('favorites')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "Get seeker's favorite guides" })
  getFavorites(@CurrentUser() user: CurrentUserData) {
    return this.seekersService.getFavorites(user.id);
  }

  @Post('favorites/:guideId')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Add a guide to favorites' })
  addFavorite(@CurrentUser() user: CurrentUserData, @Param('guideId') guideId: string) {
    return this.seekersService.addFavorite(user.id, guideId);
  }

  @Delete('favorites/:guideId')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Remove a guide from favorites' })
  removeFavorite(@CurrentUser() user: CurrentUserData, @Param('guideId') guideId: string) {
    return this.seekersService.removeFavorite(user.id, guideId);
  }
}
