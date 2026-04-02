import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { CalendlyService } from './calendly.service';

@ApiTags('Calendly')
@Controller('calendly')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CalendlyController {
  constructor(private readonly calendlyService: CalendlyService) {}

  // ─── Guide: Connection Status ──────────────────────────────────────────────

  @Get('status')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Get Calendly connection status' })
  getStatus(@CurrentUser() user: CurrentUserData) {
    return this.calendlyService.getConnectionStatus(user.id);
  }

  // ─── Guide: Event Types ────────────────────────────────────────────────────

  @Get('event-types')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "List guide's Calendly event types" })
  getEventTypes(@CurrentUser() user: CurrentUserData) {
    return this.calendlyService.getEventTypes(user.id);
  }

  // ─── Guide: Scheduled Events ───────────────────────────────────────────────

  @Get('events')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "List guide's upcoming Calendly events" })
  getScheduledEvents(@CurrentUser() user: CurrentUserData) {
    const now = new Date().toISOString();
    return this.calendlyService.getScheduledEvents(user.id, {
      status: 'active',
      minStartTime: now,
      count: 20,
    });
  }

  // ─── Guide: Scheduling Link ────────────────────────────────────────────────

  @Get('scheduling-link')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "Get guide's scheduling link for embedding" })
  getSchedulingLink(@CurrentUser() user: CurrentUserData) {
    return this.calendlyService.getSchedulingLink(user.id);
  }

  // ─── Guide: Disconnect Calendly ────────────────────────────────────────────

  @Post('disconnect')
  @Roles(Role.GUIDE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect Calendly integration' })
  disconnect(@CurrentUser() user: CurrentUserData) {
    return this.calendlyService.disconnect(user.id);
  }

  // ─── Public: Guide Booking Info (for seeker booking page) ──────────────────

  @Public()
  @Get('book/:slug')
  @ApiOperation({ summary: 'Get public booking info for a guide (services + scheduling link)' })
  @ApiResponse({ status: 200, description: 'Guide booking info' })
  @ApiResponse({ status: 404, description: 'Guide not found' })
  getPublicBookingInfo(@Param('slug') slug: string) {
    return this.calendlyService.getPublicSchedulingInfo(slug);
  }

  // ─── Webhook: Calendly Events ──────────────────────────────────────────────

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Calendly webhook events' })
  handleWebhook(
    @Body() body: any,
    @Headers('calendly-webhook-signature') signature: string,
  ) {
    return this.calendlyService.handleWebhookEvent(body, signature);
  }
}
