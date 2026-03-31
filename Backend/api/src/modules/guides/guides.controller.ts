import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { GuidesService } from './guides.service';
import { VerificationService } from '../verification/verification.service';
import { UpdateGuideProfileDto } from './dto/update-profile.dto';
import { SetCategoriesDto } from './dto/set-categories.dto';
import { AddCredentialDto } from './dto/add-credential.dto';
import { SetCalendarDto } from './dto/set-calendar.dto';

@ApiTags('Guides — Onboarding')
@Controller('guides')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GuidesController {
  constructor(
    private readonly guidesService: GuidesService,
    private readonly verificationService: VerificationService,
  ) {}

  // ─── Public: Category List ───────────────────────────────────────────────────

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List all active categories with subcategories' })
  listCategories() {
    return this.guidesService.listCategories();
  }

  // ─── Public: Guide Profile by Slug ───────────────────────────────────────────

  @Public()
  @Get('profile/:slug')
  @ApiOperation({ summary: 'Get public guide profile by slug' })
  @ApiResponse({ status: 200, description: 'Guide public profile' })
  @ApiResponse({ status: 404, description: 'Guide not found' })
  getPublicProfile(@Param('slug') slug: string) {
    return this.guidesService.getPublicProfile(slug);
  }

  // ─── My Profile (authenticated guide's own full profile) ─────────────────────

  @Get('me')
  @ApiOperation({ summary: "Get the authenticated guide's own editable profile" })
  @ApiResponse({ status: 200, description: 'Guide profile' })
  getMyProfile(@CurrentUser() user: CurrentUserData) {
    return this.guidesService.getMyProfile(user.id);
  }

  // ─── Onboarding Status ───────────────────────────────────────────────────────

  @Get('onboarding/status')
  @ApiOperation({ summary: 'Get onboarding status for the authenticated user' })
  getStatus(@CurrentUser() user: CurrentUserData) {
    return this.guidesService.getOnboardingStatus(user.id);
  }

  // ─── Step 0: Start ───────────────────────────────────────────────────────────

  @Post('onboarding/start')
  @ApiOperation({ summary: 'Step 0 — Create guide profile and assign GUIDE role' })
  @ApiResponse({ status: 201, description: 'Guide profile created' })
  startOnboarding(@CurrentUser() user: CurrentUserData) {
    return this.guidesService.startOnboarding(user.id);
  }

  // ─── Step 1: Categories ──────────────────────────────────────────────────────

  @Put('onboarding/categories')
  @ApiOperation({ summary: 'Step 1 — Set practice categories and subcategories' })
  setCategories(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SetCategoriesDto,
  ) {
    return this.guidesService.setCategories(user.id, dto);
  }

  // ─── Step 2: Profile ─────────────────────────────────────────────────────────

  @Put('onboarding/profile')
  @ApiOperation({ summary: 'Step 2 — Update guide profile (bio, photo, location, etc.)' })
  updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateGuideProfileDto,
  ) {
    return this.guidesService.updateProfile(user.id, dto);
  }

  // ─── Step 3: Credentials ─────────────────────────────────────────────────────

  @Post('onboarding/credentials')
  @ApiOperation({ summary: 'Step 3 — Add a credential/certification document' })
  addCredential(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AddCredentialDto,
  ) {
    return this.guidesService.addCredential(user.id, dto);
  }

  @Delete('onboarding/credentials/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3 — Remove a credential document' })
  deleteCredential(
    @CurrentUser() user: CurrentUserData,
    @Param('id') credentialId: string,
  ) {
    return this.guidesService.deleteCredential(user.id, credentialId);
  }

  // ─── Step 5: Calendar & Pricing ──────────────────────────────────────────────

  @Put('onboarding/calendar')
  @ApiOperation({ summary: 'Step 5 — Save calendar integration and session pricing' })
  saveCalendar(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SetCalendarDto,
  ) {
    return this.guidesService.saveCalendarSettings(user.id, dto);
  }

  // ─── Step 4: Submit ──────────────────────────────────────────────────────────

  @Post('onboarding/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 4 — Submit onboarding for verification' })
  async submitOnboarding(@CurrentUser() user: CurrentUserData) {
    const guide = await this.guidesService.submitOnboarding(user.id);
    await this.verificationService.enqueueGuideVerification(guide.id);
    return guide;
  }
}
