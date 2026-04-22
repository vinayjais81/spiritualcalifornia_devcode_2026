import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Single source of truth for platform-wide settings that the frontend needs
 * to render correctly (fees, policies, contact emails, minimums, etc).
 *
 * Values currently sourced from env vars / constants; later migrates to a
 * `SiteSettings` table + admin editor (see docs/static-to-dynamic-audit.md).
 */
@ApiTags('Config')
@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Public platform config — fees, policies, contact info, minimums' })
  getPublicConfig() {
    const commissionPercent = Number(
      this.config.get<string>('STRIPE_PLATFORM_COMMISSION_PERCENT') ?? '15',
    );
    const eventBookingFeePercent = Number(
      this.config.get<string>('EVENT_BOOKING_FEE_PERCENT') ?? '5',
    );
    const minPayoutUsd = Number(this.config.get<string>('MIN_PAYOUT_USD') ?? '10');
    const returnWindowDays = Number(this.config.get<string>('RETURN_WINDOW_DAYS') ?? '30');

    return {
      // ── Fees ──────────────────────────────────────────────────────────────
      fees: {
        /** % of the guide's gross income kept by the platform (Stripe Connect application fee). */
        platformCommissionPercent: commissionPercent,
        /** % added on top of the ticket subtotal at event checkout. */
        eventBookingFeePercent,
      },

      // ── Payouts ───────────────────────────────────────────────────────────
      payouts: {
        /** Minimum payable balance before a guide can request a payout. */
        minUsd: minPayoutUsd,
      },

      // ── Cancellation policies ────────────────────────────────────────────
      // These are platform defaults; specific services/events/tours can
      // override via their own `cancellationPolicy` JSON columns.
      cancellationPolicies: {
        service: {
          fullRefundHoursBefore: 48,
          halfRefundHoursBefore: 48, // between 0 and 48h
          freeRescheduleHoursBefore: 24,
          noShowRefund: false,
          text:
            'Full refund if cancelled 48+ hours before the session. 50% refund within 48 hours. ' +
            'No refund for no-shows. You may reschedule once at no charge up to 24 hours before the session.',
        },
        event: {
          fullRefundDaysBefore: 7,
          halfRefundDaysBefore: 3, // between 48h and 7d
          noRefundHoursBefore: 48,
          text:
            'Full refund up to 7 days before the event. 50% refund between 3 and 7 days before. ' +
            'No refund within 48 hours of the start time.',
        },
        tourDefault: {
          fullRefundDaysBefore: 90,
          halfRefundDaysBefore: 60,
          text:
            'Full refund of the deposit if cancelled 90+ days before departure. ' +
            '50% refund between 60 and 89 days before. No refund within 60 days.',
        },
      },

      // ── Product / order policy ───────────────────────────────────────────
      orders: {
        returnWindowDays,
      },

      // ── Contact + brand ──────────────────────────────────────────────────
      contactEmails: {
        support:
          this.config.get<string>('CONTACT_EMAIL_SUPPORT') ?? 'hello@spiritualcalifornia.com',
        privacy:
          this.config.get<string>('CONTACT_EMAIL_PRIVACY') ?? 'privacy@spiritualcalifornia.com',
        legal:
          this.config.get<string>('CONTACT_EMAIL_LEGAL') ?? 'legal@spiritualcalifornia.com',
      },

      brand: {
        name: this.config.get<string>('BRAND_NAME') ?? 'Spiritual California',
        tagline: this.config.get<string>('BRAND_TAGLINE') ?? 'mind · body · soul',
      },
    };
  }
}
