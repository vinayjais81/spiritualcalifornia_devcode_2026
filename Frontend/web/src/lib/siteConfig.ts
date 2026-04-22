'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/api';
import { SITE_CONFIG_FALLBACK, type SiteConfig } from '@/lib/siteConfig.constants';

// Re-export so existing imports keep working.
export { SITE_CONFIG_FALLBACK };
export type { SiteConfig };

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
 * Hook variant that always returns a non-null config by falling back to
 * defaults while the request is in-flight. Useful for components that can't
 * easily render a skeleton state.
 */
export function useSiteConfigOrFallback(): SiteConfig {
  const cfg = useSiteConfig();
  return cfg ?? SITE_CONFIG_FALLBACK;
}
