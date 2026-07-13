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

  // ─── Stripe Webhook (raw body for signature verification) ──────────────────
  // NOTE on route ordering: the catch-all `@Get(':id')` for payment details
  // sits at the BOTTOM of this controller (not the top, where it used to be).
  // NestJS resolves routes in declaration order, so a `:id` wildcard at the
  // top swallows every specific literal route below it — that bug caused
  // GET /payments/earnings to throw "Payment not found" (id=earnings) until
  // 2026-05-12 when the order was corrected.

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

  // ─── Guide Subscription ($50/mo Standard listing) ──────────────────────────
  // Literal routes — MUST stay above the `@Get(':id')` wildcard below.

  @Get('subscription/status')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "Get guide's subscription + free-period status" })
  subscriptionStatus(@CurrentUser() user: CurrentUserData) {
    return this.paymentsService.getSubscriptionStatus(user.id);
  }

  @Post('subscription/checkout')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Start a Stripe Checkout for the Standard listing plan' })
  subscriptionCheckout(
    @CurrentUser() user: CurrentUserData,
    @Body('plan') plan: 'monthly' | 'annual',
  ) {
    return this.paymentsService.createSubscriptionCheckout(user.id, plan ?? 'monthly');
  }

  @Post('subscription/portal')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Get a Stripe billing-portal link to manage/cancel' })
  subscriptionPortal(@CurrentUser() user: CurrentUserData) {
    return this.paymentsService.createSubscriptionPortal(user.id);
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

  // ─── Get Payment Details ───────────────────────────────────────────────────
  // KEEP THIS BELOW ALL SPECIFIC ROUTES. NestJS resolves routes in declaration
  // order; a `:id` wildcard above any literal route swallows it.

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
}
