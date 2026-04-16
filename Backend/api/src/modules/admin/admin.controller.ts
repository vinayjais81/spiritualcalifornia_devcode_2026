import {
  Controller,
  Get,
  Post,
  Patch,
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
import { BanUserDto } from './dto/ban-user.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { RejectGuideDto } from './dto/reject-guide.dto';
import { VerificationStatus, TourBookingStatus, BookingStatus, PayoutStatus } from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class GuidesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
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
  @ApiOperation({ summary: 'List all users with pagination and search' })
  getUsers(@Query() query: PaginationQueryDto) {
    return this.adminService.getUsers({
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get detailed user info' })
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a user' })
  banUser(@Param('id') id: string, @Body() dto: BanUserDto) {
    return this.adminService.banUser(id, dto.reason);
  }

  @Patch('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban a user' })
  unbanUser(@Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  @Patch('users/:id/roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set user roles (replaces all existing roles)' })
  setUserRoles(@Param('id') id: string, @Body() dto: UpdateRolesDto) {
    return this.adminService.setUserRoles(id, dto.roles);
  }

  // ─── Guides ───────────────────────────────────────────────────────────────

  @Get('guides')
  @ApiOperation({ summary: 'List all guide profiles' })
  getGuides(@Query() query: GuidesQueryDto) {
    return this.adminService.getGuides({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
    });
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
}
