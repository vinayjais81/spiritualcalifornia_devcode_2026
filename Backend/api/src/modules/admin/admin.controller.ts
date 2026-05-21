import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from './dto/query.dto';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { RejectGuideDto } from './dto/reject-guide.dto';
import { AdminCreatePostDto, AdminUpdatePostDto } from './dto/admin-blog.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';
import { ConvertTestAccountDto, SetTestAccountFlagDto } from './dto/convert-test-account.dto';
import { VerificationStatus, TourBookingStatus, BookingStatus, PayoutStatus, EarningCategory } from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { IsOptional, IsEnum, IsString, IsNumber, IsArray, Min, Max, IsDateString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

class GuidesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @ApiPropertyOptional({ enum: ['sortOrder', 'displayName', 'createdAt', 'rating'] })
  @IsOptional()
  @IsEnum(['sortOrder', 'displayName', 'createdAt', 'rating'] as const)
  sortBy?: 'sortOrder' | 'displayName' | 'createdAt' | 'rating';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sortDir?: 'asc' | 'desc';
}

class ReorderRowDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsNumber()
  sortOrder!: number;
}

class ReorderDto {
  // class-validator + global ValidationPipe with forbidNonWhitelisted: true
  // requires every accepted property to carry at least one validation
  // decorator. @ApiProperty alone is doc-only and doesn't count, so without
  // these the entire body fails with "property rows should not exist".
  @ApiProperty({ type: [ReorderRowDto], description: 'Rows in their new display order. sortOrder typically matches array index.' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderRowDto)
  rows!: ReorderRowDto[];
}

class UsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['active', 'deactivated', 'unverified'],
    description:
      'Filter by lifecycle bucket. Omit for "all". active = isActive+verified, unverified = isActive+!verified, deactivated = !isActive.',
  })
  @IsOptional()
  @IsEnum(['active', 'deactivated', 'unverified'] as const)
  status?: 'active' | 'deactivated' | 'unverified';
}

class ProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsEnum(['active', 'inactive'] as const)
  status?: 'active' | 'inactive';

  @ApiPropertyOptional({ enum: ['DIGITAL', 'PHYSICAL'] })
  @IsOptional()
  @IsEnum(['DIGITAL', 'PHYSICAL'] as const)
  type?: 'DIGITAL' | 'PHYSICAL';

  @ApiPropertyOptional({ enum: ['sortOrder', 'name', 'price', 'createdAt'] })
  @IsOptional()
  @IsEnum(['sortOrder', 'name', 'price', 'createdAt'] as const)
  sortBy?: 'sortOrder' | 'name' | 'price' | 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sortDir?: 'asc' | 'desc';
}

class AdminEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['published', 'draft', 'cancelled'] })
  @IsOptional()
  @IsEnum(['published', 'draft', 'cancelled'] as const)
  status?: 'published' | 'draft' | 'cancelled';

  @ApiPropertyOptional({ enum: ['VIRTUAL', 'IN_PERSON', 'SOUL_TRAVEL', 'RETREAT'] })
  @IsOptional()
  @IsEnum(['VIRTUAL', 'IN_PERSON', 'SOUL_TRAVEL', 'RETREAT'] as const)
  type?: 'VIRTUAL' | 'IN_PERSON' | 'SOUL_TRAVEL' | 'RETREAT';

  @ApiPropertyOptional({ enum: ['sortOrder', 'title', 'startTime', 'createdAt'] })
  @IsOptional()
  @IsEnum(['sortOrder', 'title', 'startTime', 'createdAt'] as const)
  sortBy?: 'sortOrder' | 'title' | 'startTime' | 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sortDir?: 'asc' | 'desc';
}

class AdminToursQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['published', 'draft', 'cancelled'] })
  @IsOptional()
  @IsEnum(['published', 'draft', 'cancelled'] as const)
  status?: 'published' | 'draft' | 'cancelled';

  @ApiPropertyOptional({ enum: ['ADVENTURE', 'HEALING'] })
  @IsOptional()
  @IsEnum(['ADVENTURE', 'HEALING'] as const)
  track?: 'ADVENTURE' | 'HEALING';

  @ApiPropertyOptional({ enum: ['sortOrder', 'title', 'startDate', 'createdAt'] })
  @IsOptional()
  @IsEnum(['sortOrder', 'title', 'startDate', 'createdAt'] as const)
  sortBy?: 'sortOrder' | 'title' | 'startDate' | 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sortDir?: 'asc' | 'desc';
}

class TourBookingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TourBookingStatus })
  @IsOptional()
  @IsEnum(TourBookingStatus)
  status?: TourBookingStatus;

  @ApiPropertyOptional({ description: 'Filter by guide profile ID' })
  @IsOptional()
  @IsString()
  guideId?: string;
}

class PayoutRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PayoutStatus })
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;
}

class ServiceBookingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ description: 'Filter by guide profile ID' })
  @IsOptional()
  @IsString()
  guideId?: string;
}

class ReasonDto {
  @ApiProperty({ description: 'Required reason — surfaced in audit log + guide notification' })
  @IsString()
  reason!: string;
}

class CommissionRateUpsertDto {
  @ApiProperty({ enum: EarningCategory })
  @IsEnum(EarningCategory)
  category!: EarningCategory;

  @ApiPropertyOptional({ description: 'Per-guide override; omit for platform default' })
  @IsOptional()
  @IsString()
  guideId?: string;

  @ApiProperty({ description: 'Commission percent — 15 = 15%' })
  @IsNumber()
  @Min(0)
  @Max(100)
  percent!: number;

  @ApiPropertyOptional({ description: 'ISO date when this rate becomes effective' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date when this rate stops being effective' })
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;
}

class PayoutsSummaryQueryDto {
  @ApiPropertyOptional({ description: 'ISO date — start of window (inclusive). Defaults to 30 days ago.' })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({ description: 'ISO date — end of window (exclusive). Defaults to now.' })
  @IsOptional()
  @IsDateString()
  until?: string;

  @ApiPropertyOptional({ enum: EarningCategory })
  @IsOptional()
  @IsEnum(EarningCategory)
  category?: EarningCategory;
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly config: ConfigService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard KPIs' })
  @ApiOkResponse({ description: 'Dashboard statistics' })
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ─── Integration Status ───────────────────────────────────────────────────

  @Get('integration-status')
  @ApiOperation({ summary: 'Live integration status derived from env config' })
  getIntegrationStatus() {
    const g = <T>(key: string) => this.config.get<T>(key);

    const stripeKey = g<string>('STRIPE_SECRET_KEY') ?? '';
    const resendKey = g<string>('RESEND_API_KEY') ?? '';
    const personaKey = g<string>('PERSONA_API_KEY') ?? '';
    const awsKey    = g<string>('AWS_ACCESS_KEY_ID') ?? '';
    const awsBucket = g<string>('AWS_S3_BUCKET') ?? '';
    const claudeKey = g<string>('ANTHROPIC_API_KEY') ?? '';
    const algoliaId = g<string>('ALGOLIA_APP_ID') ?? '';
    const zoomId    = g<string>('ZOOM_ACCOUNT_ID') ?? '';
    const calendlyId = g<string>('CALENDLY_CLIENT_ID') ?? '';

    const isSet = (v: string) => !!v && !v.startsWith('your-');

    return [
      {
        name: 'API Server',
        description: 'NestJS 11 REST API',
        detail: `http://localhost:${g('PORT') ?? 3001}`,
        status: 'operational',
      },
      {
        name: 'PostgreSQL',
        description: 'Primary database (Prisma ORM)',
        detail: 'PostgreSQL 16',
        status: 'operational',
      },
      {
        name: 'Stripe Connect',
        description: 'Payments & payouts',
        detail: stripeKey.startsWith('sk_live') ? 'Live mode' : 'Test mode — no charges',
        status: isSet(stripeKey) ? (stripeKey.startsWith('sk_live') ? 'operational' : 'test') : 'unconfigured',
      },
      {
        name: 'Resend',
        description: 'Transactional email',
        detail: isSet(resendKey) ? `From: ${g('EMAIL_FROM') ?? '—'}` : 'API key not set',
        status: isSet(resendKey) ? 'operational' : 'unconfigured',
      },
      {
        name: 'Persona',
        description: 'Identity verification',
        detail: personaKey.startsWith('persona_sandbox') ? 'Sandbox mode' : isSet(personaKey) ? 'Live mode' : 'API key not set',
        status: personaKey.startsWith('persona_sandbox') ? 'test' : isSet(personaKey) ? 'operational' : 'unconfigured',
      },
      {
        name: 'AWS S3 + CloudFront',
        description: 'File storage & CDN',
        detail: isSet(awsKey) ? `Bucket: ${awsBucket}` : 'Credentials not set',
        status: isSet(awsKey) && isSet(awsBucket) ? 'operational' : 'unconfigured',
      },
      {
        name: 'Anthropic Claude',
        description: 'AI Guide chatbot & NLP',
        detail: isSet(claudeKey) ? `Model: ${g('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6'}` : 'API key not set',
        status: isSet(claudeKey) ? 'operational' : 'unconfigured',
      },
      {
        name: 'Algolia',
        description: 'Guide & service search',
        detail: isSet(algoliaId) ? `App: ${algoliaId}` : 'App ID not set',
        status: isSet(algoliaId) ? 'operational' : 'unconfigured',
      },
      {
        name: 'Zoom',
        description: 'Virtual events & sessions',
        detail: isSet(zoomId) ? `Account: ${zoomId}` : 'Credentials not set',
        status: isSet(zoomId) ? 'operational' : 'unconfigured',
      },
      {
        name: 'Calendly',
        description: 'Calendar scheduling',
        detail: isSet(calendlyId) ? 'OAuth configured' : 'Client ID not set',
        status: isSet(calendlyId) ? 'operational' : 'unconfigured',
      },
    ];
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination, search, and lifecycle filter' })
  getUsers(@Query() query: UsersQueryDto) {
    return this.adminService.getUsers({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get detailed user info' })
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Deactivate a user. Blocks login, hides from public surfaces, revokes all active sessions. Reversible via /activate. Reason required.',
  })
  deactivateUser(
    @Param('id') id: string,
    @Body() dto: DeactivateUserDto,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.adminService.deactivateUser({
      targetUserId: id,
      actor: { id: actor.id, roles: actor.roles, email: actor.email },
      reason: dto.reason,
    });
  }

  @Patch('users/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a previously deactivated user.' })
  activateUser(@Param('id') id: string, @CurrentUser() actor: CurrentUserData) {
    return this.adminService.activateUser({
      targetUserId: id,
      actor: { id: actor.id, roles: actor.roles, email: actor.email },
    });
  }

  @Patch('users/:id/roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set user roles (replaces all existing roles)' })
  setUserRoles(@Param('id') id: string, @Body() dto: UpdateRolesDto) {
    return this.adminService.setUserRoles(id, dto.roles);
  }

  @Post('users/:id/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Set a user\'s password directly. Revokes all active sessions, writes an audit log, and emails the affected user. ADMIN cannot target another ADMIN/SUPER_ADMIN — SUPER_ADMIN is required for that. Nobody can set their own password via this endpoint.',
  })
  setUserPassword(
    @Param('id') id: string,
    @Body() dto: SetUserPasswordDto,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.adminService.setUserPassword({
      targetUserId: id,
      actor: { id: actor.id, roles: actor.roles, email: actor.email },
      newPassword: dto.newPassword,
      reason: dto.reason,
    });
  }

  // ─── Test-account conversion (pre-launch onboarding) ─────────────────────

  @Patch('users/:id/convert-test-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Swap a test-account user\'s email for a real address and (by default) email a claim-invite link. Old email + password stop working immediately. Requires User.isTestAccount = true.',
  })
  convertTestAccount(
    @Param('id') id: string,
    @Body() dto: ConvertTestAccountDto,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.adminService.convertTestAccount({
      targetUserId: id,
      actor: { id: actor.id, roles: actor.roles, email: actor.email },
      newEmail: dto.newEmail,
      sendInvite: dto.sendInvite !== false,
      reason: dto.reason,
    });
  }

  @Post('users/:id/resend-claim-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Re-issue the claim-invite for a test-account user whose email has already been swapped (token expired, original email bounced, etc.). Rotates the token so prior links stop working.',
  })
  resendClaimInvite(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.adminService.resendClaimInvite({
      targetUserId: id,
      actor: { id: actor.id, roles: actor.roles, email: actor.email },
    });
  }

  @Patch('users/:id/test-account-flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Manually set / clear User.isTestAccount. Used for backfilling historical accounts created before the auto-flag landed.',
  })
  setUserTestAccountFlag(
    @Param('id') id: string,
    @Body() body: SetTestAccountFlagDto,
    @CurrentUser() actor: CurrentUserData,
  ) {
    return this.adminService.setUserTestAccountFlag({
      targetUserId: id,
      actor: { id: actor.id, roles: actor.roles, email: actor.email },
      isTestAccount: body.isTestAccount,
    });
  }

  // ─── Guides ───────────────────────────────────────────────────────────────

  @Get('guides')
  @ApiOperation({ summary: 'List all guide profiles (with click-to-sort + admin-managed sortOrder)' })
  getGuides(@Query() query: GuidesQueryDto) {
    return this.adminService.getGuides({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
  }

  @Post('guides/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Bulk-update guide sortOrder values. Send rows in the new display order; the array index is the natural sortOrder. Used after drag-to-reorder on /admin/guides.',
  })
  reorderGuides(@Body() dto: ReorderDto) {
    return this.adminService.reorderGuides(dto.rows);
  }

  // ─── Products (cross-guide catalog admin) ─────────────────────────────────

  @Get('products')
  @ApiOperation({ summary: 'List all products across guides (with click-to-sort + admin-managed sortOrder)' })
  getProducts(@Query() query: ProductsQueryDto) {
    return this.adminService.getProducts({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      type: query.type,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
  }

  @Post('products/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-update product sortOrder. Mirrors /admin/guides/reorder.' })
  reorderProducts(@Body() dto: ReorderDto) {
    return this.adminService.reorderProducts(dto.rows);
  }

  @Patch('products/:id/active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Admin override for product visibility. Skips the payments publish-gate that the guide-facing path enforces.',
  })
  setProductActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.adminService.setProductActive(id, !!body.isActive);
  }

  // ─── Events (cross-guide catalog admin) ───────────────────────────────────

  @Get('events')
  @ApiOperation({
    summary:
      'List all events across guides (with click-to-sort + admin-managed sortOrder). Public /events stays chronological — sortOrder here is admin-side only.',
  })
  getEvents(@Query() query: AdminEventsQueryDto) {
    return this.adminService.getEvents({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      type: query.type,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
  }

  @Post('events/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-update event sortOrder. Admin-side only — does not change /events public ordering.' })
  reorderEvents(@Body() dto: ReorderDto) {
    return this.adminService.reorderEvents(dto.rows);
  }

  @Patch('events/:id/published')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin override to publish or unpublish an event. Skips the payments publish-gate.' })
  setEventPublished(
    @Param('id') id: string,
    @Body() body: { isPublished: boolean },
  ) {
    return this.adminService.setEventPublished(id, !!body.isPublished);
  }

  // ─── Tours (cross-guide catalog admin) ────────────────────────────────────

  @Get('tours')
  @ApiOperation({
    summary:
      'List all soul tours across guides (with click-to-sort + admin-managed sortOrder). Public /travels stays chronological — sortOrder here is admin-side only.',
  })
  getTours(@Query() query: AdminToursQueryDto) {
    return this.adminService.getTours({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      track: query.track,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
  }

  @Post('tours/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-update tour sortOrder. Admin-side only — does not change /travels public ordering.' })
  reorderTours(@Body() dto: ReorderDto) {
    return this.adminService.reorderTours(dto.rows);
  }

  @Patch('tours/:id/published')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin override to publish or unpublish a tour. Skips the payments publish-gate.' })
  setTourPublished(
    @Param('id') id: string,
    @Body() body: { isPublished: boolean },
  ) {
    return this.adminService.setTourPublished(id, !!body.isPublished);
  }

  @Patch('guides/:guideId/featured')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle a guide as featured on the public practitioners page' })
  setFeatured(
    @Param('guideId') guideId: string,
    @Body() body: { isFeatured: boolean },
  ) {
    return this.adminService.setFeatured(guideId, !!body.isFeatured);
  }

  // ─── Verification Queue ───────────────────────────────────────────────────

  @Get('verification')
  @ApiOperation({ summary: 'Get pending verification queue' })
  getVerificationQueue(@Query() query: PaginationQueryDto) {
    return this.adminService.getVerificationQueue({
      page: query.page,
      limit: query.limit,
    });
  }

  @Patch('verification/:guideId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a guide verification' })
  approveGuide(@Param('guideId') guideId: string) {
    return this.adminService.approveGuide(guideId);
  }

  @Patch('verification/:guideId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a guide verification' })
  rejectGuide(
    @Param('guideId') guideId: string,
    @Body() dto: RejectGuideDto,
  ) {
    return this.adminService.rejectGuide(guideId, dto.reason);
  }

  @Get('verification/credentials/:credentialId/document')
  @ApiOperation({
    summary: 'Get a short-lived signed URL to view a credential document',
  })
  getCredentialDocumentUrl(@Param('credentialId') credentialId: string) {
    return this.adminService.getCredentialDocumentUrl(credentialId);
  }

  // ─── Tour Bookings ─────────────────────────────────────────────────────────

  @Get('tour-bookings')
  @ApiOperation({ summary: 'List all tour bookings with filters' })
  getTourBookings(@Query() query: TourBookingsQueryDto) {
    return this.adminService.getTourBookings({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      guideId: query.guideId,
    });
  }

  // ─── Service Bookings ─────────────────────────────────────────────────────

  @Get('service-bookings')
  @ApiOperation({ summary: 'List all service bookings with filters' })
  getServiceBookings(@Query() query: ServiceBookingsQueryDto) {
    return this.adminService.getServiceBookings({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      guideId: query.guideId,
    });
  }

  // ─── Guide Revenue Analytics ──────────────────────────────────────────────

  @Get('guide-revenue')
  @ApiOperation({ summary: 'Guide-wise revenue breakdown (services + tours)' })
  getGuideRevenue(@Query() query: PaginationQueryDto) {
    return this.adminService.getGuideRevenue({
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
  }

  // ─── Financials ───────────────────────────────────────────────────────────

  @Get('financials')
  @ApiOperation({ summary: 'Get financial overview and payment history' })
  getFinancials(@Query() query: PaginationQueryDto) {
    return this.adminService.getFinancials({
      page: query.page,
      limit: query.limit,
    });
  }

  // ─── Payout Management ────────────────────────────────────────────────────

  @Get('payout-requests')
  @ApiOperation({ summary: 'List all guide payout requests with filters' })
  getPayoutRequests(@Query() query: PayoutRequestsQueryDto) {
    return this.adminService.getPayoutRequests({
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
  }

  @Get('guide-balances')
  @ApiOperation({ summary: 'List all guide payout account balances' })
  getGuideBalances(@Query() query: PaginationQueryDto) {
    return this.adminService.getGuideBalances({
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
  }

  @Post('payout-requests/:id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a pending payout request (triggers Stripe transfer)' })
  processPayout(@Param('id') id: string) {
    return this.paymentsService.processPayout(id);
  }

  @Post('orders/:id/mark-delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Mark an order delivered. Stamps deliveredAt on every item and writes the deferred ledger fan-out for physical products (which is skipped at charge time so the clearance window starts at delivery, not purchase).',
  })
  markOrderDelivered(@Param('id') id: string) {
    return this.paymentsService.markOrderDelivered(id);
  }

  // ─── Payouts v2 admin actions ─────────────────────────────────────────────

  @Post('payout-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending payout request without sending money' })
  rejectPayoutRequest(
    @Param('id') id: string,
    @Body() body: ReasonDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.adminService.rejectPayoutRequest({
      payoutRequestId: id,
      actorUserId: user.id,
      reason: body.reason,
    });
  }

  @Post('guides/:guideId/payouts/hold')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Freeze a guide\'s payouts (clearance + claim)' })
  holdGuidePayouts(
    @Param('guideId') guideId: string,
    @Body() body: ReasonDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.adminService.holdGuidePayouts({
      guideId,
      actorUserId: user.id,
      reason: body.reason,
    });
  }

  @Post('guides/:guideId/payouts/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lift a payout hold for a guide' })
  releaseGuidePayouts(
    @Param('guideId') guideId: string,
    @Body() body: ReasonDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.adminService.releaseGuidePayouts({
      guideId,
      actorUserId: user.id,
      reason: body.reason,
    });
  }

  @Get('commission-rates')
  @ApiOperation({ summary: 'List platform default + per-guide commission rates' })
  listCommissionRates() {
    return this.adminService.listCommissionRates();
  }

  @Post('commission-rates')
  @ApiOperation({ summary: 'Set or override a commission rate' })
  upsertCommissionRate(
    @Body() body: CommissionRateUpsertDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.adminService.upsertCommissionRate({
      actorUserId: user.id,
      category: body.category,
      guideId: body.guideId ?? null,
      percent: body.percent,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
    });
  }

  @Get('payout-audit-log')
  @ApiOperation({ summary: 'Read the payout audit log (filterable)' })
  getPayoutAuditLog(
    @Query('guideId') guideId?: string,
    @Query('payoutRequestId') payoutRequestId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getPayoutAuditLog({
      guideId,
      payoutRequestId,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('reconciliation/mismatches')
  @ApiOperation({ summary: 'List unmatched Stripe ↔ ledger entries (drift surface)' })
  listReconciliationMismatches(
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listReconciliationMismatches({
      resolved:
        resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Post('reconciliation/mismatches/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a reconciliation mismatch as resolved' })
  resolveReconciliationMismatch(
    @Param('id') id: string,
    @Body() body: ReasonDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.adminService.resolveReconciliationMismatch({
      id,
      actorUserId: user.id,
      note: body.reason,
    });
  }

  @Get('financials/payouts-summary')
  @ApiOperation({ summary: 'Aggregate payouts P&L (gross / commission / fees / paid / outstanding)' })
  getPayoutsSummary(@Query() query: PayoutsSummaryQueryDto) {
    const until = query.until ? new Date(query.until) : new Date();
    const defaultSince = new Date(until);
    defaultSince.setDate(defaultSince.getDate() - 30);
    const since = query.since ? new Date(query.since) : defaultSince;
    return this.adminService.getPayoutsSummary({
      since,
      until,
      category: query.category,
    });
  }

  // ─── Blog Management ─────────────────────────────────────────────────────
  // Admin can list/create/edit/delete any post on the platform. Create +
  // update require a `guideId` so the post stays attributed to a guide — this
  // keeps the /journal/[guideSlug]/[postSlug] URL structure intact.

  @Get('blog/authors')
  @ApiOperation({ summary: 'List all potential blog authors (guides + admin users)' })
  listBlogAuthors() {
    return this.adminService.listBlogAuthors();
  }

  @Get('blog')
  @ApiOperation({ summary: 'List all blog posts (with click-to-sort + admin-managed sortOrder)' })
  listAllPosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('guideId') guideId?: string,
    @Query('status') status?: 'all' | 'published' | 'draft',
    @Query('sortBy') sortBy?: 'sortOrder' | 'title' | 'publishedAt' | 'createdAt',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.adminService.listAllPosts({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      guideId,
      status: status ?? 'all',
      sortBy,
      sortDir,
    });
  }

  @Post('blog/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-update blog post sortOrder. Mirrors /admin/guides/reorder.' })
  reorderBlogPosts(@Body() dto: ReorderDto) {
    return this.adminService.reorderBlogPosts(dto.rows);
  }

  @Get('blog/:id')
  @ApiOperation({ summary: 'Get a single blog post (for editing)' })
  getPost(@Param('id') id: string) {
    return this.adminService.getPost(id);
  }

  @Post('blog')
  @ApiOperation({ summary: 'Create a blog post attributed to any guide' })
  createPost(@Body() dto: AdminCreatePostDto) {
    return this.adminService.createPost(dto);
  }

  @Patch('blog/:id')
  @ApiOperation({ summary: 'Update any blog post (can also reassign to a different guide)' })
  updatePost(@Param('id') id: string, @Body() dto: AdminUpdatePostDto) {
    return this.adminService.updatePost(id, dto);
  }

  @Delete('blog/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete any blog post' })
  deletePost(@Param('id') id: string) {
    return this.adminService.deletePost(id);
  }
}
