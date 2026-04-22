import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/api';

/**
 * Shape of the response from GET /config/public. Mirrors the backend
 * controller at Backend/api/src/modules/config/config.controller.ts.
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
 * Module-level cache so multiple components calling `useSiteConfig()` share
 * a single network request per session. The store also never clears — config
 * is platform-wide and rarely changes.
 */
interface Store {
  config: SiteConfig | null;
  loading: boolean;
  fetch: () => Promise<void>;
}

const useStore = create<Store>((set, get) => ({
  config: null,
  loading: false,
  fetch: async () => {
    if (get().config || get().loading) return;
    set({ loading: true });
    try {
      const { data } = await api.get<SiteConfig>('/config/public');
      set({ config: data, loading: false });
    } catch {
      set({ loading: false }); // leave config null so callers fall back
    }
  },
}));

/**
 * Hook: returns the site config, triggering a fetch the first time any
 * component calls it. Safe to call from many components simultaneously —
 * deduped internally.
 */
export function useSiteConfig(): SiteConfig | null {
  const config = useStore((s) => s.config);
  const fetchConfig = useStore((s) => s.fetch);
  useEffect(() => {
    if (!config) fetchConfig();
  }, [config, fetchConfig]);
  return config;
}

/**
 * Fallback values used before the /config/public response lands, or when
 * the request fails. Kept in sync with the backend defaults in
 * ConfigController.getPublicConfig().
 */
export const SITE_CONFIG_FALLBACK: SiteConfig = {
  fees: { platformCommissionPercent: 15, eventBookingFeePercent: 5 },
  payouts: { minUsd: 10 },
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

/**
 * Hook variant that always returns a non-null config by falling back to
 * defaults while the request is in-flight. Useful for components that can't
 * easily render a skeleton state.
 */
export function useSiteConfigOrFallback(): SiteConfig {
  const cfg = useSiteConfig();
  return cfg ?? SITE_CONFIG_FALLBACK;
}
