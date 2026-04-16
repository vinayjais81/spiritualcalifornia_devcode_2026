import {
  Controller, Get, Post, Param, Body, Req, UseGuards,
  HttpCode, HttpStatus, RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Get Payment Details ───────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get payment details' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  // ─── Refund ────────────────────────────────────────────────────────────────

  @Post(':id/refund')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Refund a payment (full or partial)' })
  refund(@Param('id') id: string, @Body('amount') amount?: number) {
    return this.paymentsService.refund(id, amount);
  }

  // ─── Stripe Webhook (raw body for signature verification) ──────────────────

  @Public()
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint (raw body required)' })
  handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      return { received: false, error: 'Missing body or signature' };
    }
    return this.paymentsService.handleStripeWebhook(rawBody, signature);
  }

  // ─── Stripe Connect Onboarding (Guide) ─────────────────────────────────────

  @Post('connect/onboard')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Start or resume Stripe Connect onboarding for guide' })
  connectOnboard(@CurrentUser() user: CurrentUserData) {
    return this.paymentsService.createConnectOnboarding(user.id);
  }

  @Get('connect/status')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Get Stripe Connect account status' })
  connectStatus(@CurrentUser() user: CurrentUserData) {
    return this.paymentsService.getConnectStatus(user.id);
  }

  // ─── Earnings & Payouts (Guide) ────────────────────────────────────────────

  @Get('earnings')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "Get guide's earnings summary and recent payments" })
  getEarnings(@CurrentUser() user: CurrentUserData) {
    return this.paymentsService.getGuideEarnings(user.id);
  }

  @Post('payout')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Request a payout (guide cashout)' })
  requestPayout(@CurrentUser() user: CurrentUserData, @Body('amount') amount: number) {
    return this.paymentsService.requestPayout(user.id, amount);
  }

  @Get('payout-history')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "Get guide's payout request history" })
  getPayoutHistory(@CurrentUser() user: CurrentUserData) {
    return this.paymentsService.getGuidePayoutHistory(user.id);
  }

  // ─── Create Payment Intent (for frontend Stripe Elements) ──────────────────

  @Post('create-intent')
  @ApiOperation({ summary: 'Create a payment intent and return client secret for Stripe Elements' })
  createIntent(@Body() data: {
    amount: number;
    bookingId?: string;
    orderId?: string;
    ticketPurchaseId?: string;
    tourBookingId?: string;
    paymentType?: 'FULL' | 'DEPOSIT' | 'BALANCE';
  }) {
    return this.paymentsService.createPaymentIntent(data);
  }

  // ─── Confirm Payment (called by frontend after Stripe.confirmPayment) ─────

  @Post('confirm-payment')
  @ApiOperation({ summary: 'Confirm payment after successful Stripe charge (fallback for webhook)' })
  confirmPayment(@Body() data: { paymentIntentId: string }) {
    return this.paymentsService.confirmPayment(data.paymentIntentId);
  }
}
