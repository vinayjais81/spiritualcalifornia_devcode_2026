/**
 * Server-safe module: types + fallback data only, no React.
 *
 * Split out of siteConfig.ts so legal/static server components (Privacy,
 * Terms) can import SITE_CONFIG_FALLBACK without pulling in the client-only
 * Zustand store + useEffect hook.
 */

export interface SiteConfig {
  fees: {
    platformCommissionPercent: number;
    eventBookingFeePercent: number;
  };
  payouts: {
    minUsd: number;
  };
  cancellationPolicies: {
    service: {
      fullRefundHoursBefore: number;
      halfRefundHoursBefore: number;
      freeRescheduleHoursBefore: number;
      noShowRefund: boolean;
      text: string;
    };
    event: {
      fullRefundDaysBefore: number;
      halfRefundDaysBefore: number;
      noRefundHoursBefore: number;
      text: string;
    };
    tourDefault: {
      fullRefundDaysBefore: number;
      halfRefundDaysBefore: number;
      text: string;
    };
  };
  orders: {
    returnWindowDays: number;
  };
  contactEmails: {
    support: string;
    privacy: string;
    legal: string;
  };
  brand: {
    name: string;
    tagline: string;
  };
}

/**
 * Fallback values used before the /config/public response lands, or when
 * the request fails. Kept in sync with the backend defaults in
 * ConfigController.getPublicConfig().
 */
export const SITE_CONFIG_FALLBACK: SiteConfig = {
  fees: { platformCommissionPercent: 15, eventBookingFeePercent: 5 },
  payouts: { minUsd: 50 },
  cancellationPolicies: {
    service: {
      fullRefundHoursBefore: 48,
      halfRefundHoursBefore: 48,
      freeRescheduleHoursBefore: 24,
      noShowRefund: false,
      text:
        'Full refund if cancelled 48+ hours before the session. 50% refund within 48 hours. ' +
        'No refund for no-shows. You may reschedule once at no charge up to 24 hours before the session.',
    },
    event: {
      fullRefundDaysBefore: 7,
      halfRefundDaysBefore: 3,
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
  orders: { returnWindowDays: 30 },
  contactEmails: {
    support: 'hello@spiritualcalifornia.com',
    privacy: 'privacy@spiritualcalifornia.com',
    legal: 'legal@spiritualcalifornia.com',
  },
  brand: { name: 'Spiritual California', tagline: 'mind · body · soul' },
};
