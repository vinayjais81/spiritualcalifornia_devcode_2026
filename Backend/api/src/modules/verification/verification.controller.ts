import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { VerificationService } from './verification.service';
import { StripeService } from '../payments/stripe.service';
import { PrismaService } from '../../database/prisma.service';
import Stripe from 'stripe';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

@ApiTags('Verification')
@Controller('verification')
export class VerificationController {
  private readonly logger = new Logger(VerificationController.name);

  constructor(
    private readonly verificationService: VerificationService,
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Stripe Identity Webhook (no auth — Stripe calls this directly) ──────

  /**
   * POST /verification/stripe-identity/webhook
   * Stripe posts identity.verification_session.* events here. The Stripe SDK
   * verifies the signature (HMAC + replay protection) against the dedicated
   * STRIPE_IDENTITY_WEBHOOK_SECRET. Idempotent via the stripe_webhook_events
   * table (shared with payments).
   */
  @Post('stripe-identity/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Stripe Identity] Receive identity verification webhook' })
  async stripeIdentityWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    // express.raw() (main.ts) puts the raw bytes on req.body and bypasses
    // Nest's rawBody capture, so req.rawBody is undefined — fall back to
    // req.body so signature verification receives the exact bytes.
    const rawBody = req.rawBody ?? (req.body as Buffer);
    if (!rawBody || !Buffer.isBuffer(rawBody) || !signature) {
      throw new BadRequestException('Missing raw body or Stripe signature');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructIdentityEvent(rawBody, signature);
    } catch (err: any) {
      this.logger.warn(`[Identity] Webhook signature verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid Stripe Identity webhook signature');
    }

    // Idempotency — skip if we've already processed this event id.
    const seen = await this.prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } });
    if (seen) {
      return { received: true, duplicate: true };
    }

    if (event.type.startsWith('identity.verification_session.')) {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      await this.verificationService.handleIdentityWebhook({
        verificationSessionId: session.id,
        status: session.status,
        lastError: session.last_error?.reason ?? null,
      });
    }

    await this.prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });

    return { received: true };
  }

  // ─── Guide: Start Identity Verification ──────────────────────────────────

  /**
   * POST /verification/identity/start
   * Creates a Stripe Identity VerificationSession for the authenticated guide
   * and returns the hosted URL. [STUB] Returns a mock session id until the
   * Stripe Identity webhook secret is configured.
   */
  @Post('identity/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a Stripe Identity verification session' })
  async startIdentityVerification(@Req() req: any) {
    const userId: string = req.user?.id;
    return this.verificationService.startIdentityVerification(userId);
  }

  // ─── Admin Endpoints ──────────────────────────────────────────────────────

  /**
   * GET /verification/queue
   * Returns all guides pending admin review.
   */
  @Get('queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all guides pending verification review' })
  getPendingReviews() {
    return this.verificationService.getPendingReviews();
  }

  /**
   * POST /verification/guides/:guideId/approve
   */
  @Post('guides/:guideId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a guide after credential + identity review' })
  @ApiResponse({ status: 200, description: 'Guide approved and published' })
  async approveGuide(
    @Param('guideId') guideId: string,
    @Body() body: { notes?: string },
  ) {
    await this.verificationService.reviewGuide(guideId, 'approve', body?.notes);
    return { message: 'Guide approved and published' };
  }

  /**
   * POST /verification/guides/:guideId/reject
   */
  @Post('guides/:guideId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a guide verification request' })
  async rejectGuide(
    @Param('guideId') guideId: string,
    @Body() body: { notes?: string },
  ) {
    await this.verificationService.reviewGuide(guideId, 'reject', body?.notes);
    return { message: 'Guide verification rejected' };
  }
}
