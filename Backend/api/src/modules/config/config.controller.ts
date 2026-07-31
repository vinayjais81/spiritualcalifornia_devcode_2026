import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EarningCategory } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
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
  private readonly logger = new Logger(ConfigController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * The platform's live commission rates, read from the same `CommissionRate`
   * rows the ledger charges against.
   *
   * This used to report `STRIPE_PLATFORM_COMMISSION_PERCENT` instead, which is
   * only the last-resort fallback for a category with no rate row — so the
   * guide dashboard told practitioners 15% while their payouts were calculated
   * at the v2.1 policy's 20%. Reading the rows is the only way the number a
   * guide is shown can't drift from the number they're charged.
   */
  private async getCommissionRates(): Promise<Record<EarningCategory, number>> {
    const fallback = Number(
      this.config.get<string>('STRIPE_PLATFORM_COMMISSION_PERCENT') ?? '15',
    );
    const now = new Date();

    // Platform defaults only (guideId IS NULL) — per-guide overrides are
    // nobody else's business and this endpoint is public.
    const rows = await this.prisma.commissionRate.findMany({
      where: {
        guideId: null,
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { category: true, percent: true },
    });

    const byCategory = {} as Record<EarningCategory, number>;
    for (const category of Object.values(EarningCategory)) {
      // Rows are newest-first, so the first hit per category is the live rate.
      const row = rows.find((r) => r.category === category);
      byCategory[category] = row ? Number(row.percent) : fallback;
      if (!row) {
        this.logger.warn(
          `No CommissionRate row for ${category} — reporting the env fallback (${fallback}%). This is what the ledger will charge too.`,
        );
      }
    }
    return byCategory;
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Public platform config — fees, policies, contact info, minimums' })
  async getPublicConfig() {
    const commissionByCategory = await this.getCommissionRates();
    // Headline rate = what a guide's sessions, events and tours are charged.
    // Products sit at their own rate and are reported separately.
    const commissionPercent = commissionByCategory.SERVICE;
    const eventBookingFeePercent = Number(
      this.config.get<string>('EVENT_BOOKING_FEE_PERCENT') ?? '5',
    );
    const minPayoutUsd = Number(this.config.get<string>('MIN_PAYOUT_USD') ?? '100');
    const returnWindowDays = Number(this.config.get<string>('RETURN_WINDOW_DAYS') ?? '30');

    return {
      // ── Fees ──────────────────────────────────────────────────────────────
      fees: {
        /** % of the guide's gross kept by the platform on sessions, events and tours. */
        platformCommissionPercent: commissionPercent,
        /**
         * Live per-category rates, straight from the CommissionRate table.
         * Products carry their own rate, so anything quoting a single figure
         * to a guide selling products is quoting the wrong one.
         */
        commissionByCategory: commissionByCategory,
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
