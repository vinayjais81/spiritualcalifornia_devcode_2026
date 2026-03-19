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
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { VerificationService } from './verification.service';
import { createHmac, timingSafeEqual } from 'crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

@ApiTags('Verification')
@Controller('verification')
export class VerificationController {
  private readonly logger = new Logger(VerificationController.name);

  constructor(
    private readonly verificationService: VerificationService,
    private readonly config: ConfigService,
  ) {}

  // ─── Persona Webhook (no auth — Persona calls this directly) ─────────────

  /**
   * POST /verification/persona/webhook
   * Persona posts identity verification results here.
   * Validates the Persona-Signature HMAC-SHA256 header before processing.
   * Signature format: "t=<timestamp>,v1=<hmac_sha256_hex>"
   * Signed payload: "<timestamp>.<rawBody>"
   */
  @Post('persona/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Persona] Receive identity verification webhook' })
  async personaWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Headers('persona-signature') signatureHeader: string,
  ) {
    const webhookSecret = this.config.get<string>('PERSONA_WEBHOOK_SECRET', '');

    if (webhookSecret) {
      if (!signatureHeader) {
        throw new UnauthorizedException('Missing Persona-Signature header');
      }

      // Parse t=<timestamp>,v1=<signature>
      const parts = Object.fromEntries(
        signatureHeader.split(',').map((p) => p.split('=')),
      );
      const timestamp = parts['t'];
      const receivedSig = parts['v1'];

      if (!timestamp || !receivedSig) {
        throw new UnauthorizedException('Malformed Persona-Signature header');
      }

      // Reject replays older than 5 minutes
      const age = Date.now() / 1000 - parseInt(timestamp, 10);
      if (age > 300) {
        throw new UnauthorizedException('Persona webhook replay detected — timestamp too old');
      }

      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
      const expectedSig = createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${rawBody.toString()}`)
        .digest('hex');

      const expected = Buffer.from(expectedSig, 'hex');
      const received = Buffer.from(receivedSig, 'hex');

      if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        this.logger.warn('[Persona] Webhook signature mismatch — rejecting');
        throw new UnauthorizedException('Invalid Persona webhook signature');
      }
    } else {
      this.logger.warn('[Persona] PERSONA_WEBHOOK_SECRET not set — skipping signature check');
    }

    const eventType: string = body?.data?.type ?? '';
    const inquiryId: string = body?.data?.id ?? '';

    if (!inquiryId) {
      throw new BadRequestException('Missing inquiry id in Persona webhook payload');
    }

    // Map Persona event types to internal status
    let status: 'approved' | 'declined' | 'needs_review' = 'needs_review';
    if (eventType === 'inquiry.approved') status = 'approved';
    else if (eventType === 'inquiry.declined') status = 'declined';

    await this.verificationService.handlePersonaWebhook({ inquiryId, status });

    return { received: true };
  }

  // ─── Guide: Start Identity Verification ──────────────────────────────────

  /**
   * POST /verification/identity/start
   * Initiates a Persona identity inquiry for the authenticated guide.
   * [STUB] Returns a mock inquiry ID until Persona API keys are configured.
   */
  @Post('identity/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a Persona identity verification inquiry' })
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
