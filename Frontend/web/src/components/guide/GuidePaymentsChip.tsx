'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ConnectStatus {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

const C = {
  gold: '#E8B84B',
  goldPale: '#FDF6E3',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
};

type State = 'not-started' | 'in-progress' | 'payouts-disabled' | 'complete';

function deriveState(s: ConnectStatus | undefined): State {
  if (!s) return 'not-started';
  if (!s.connected) return 'not-started';
  if (!s.detailsSubmitted) return 'in-progress';
  if (!s.payoutsEnabled) return 'payouts-disabled';
  return 'complete';
}

const COPY: Record<State, { headline: string; sub: string; cta: string; tone: 'amber' | 'green' | 'gray' }> = {
  'not-started': {
    headline: 'Set up payments to start earning',
    sub: 'Connect a bank account through Stripe — required before you can publish paid services, events, or products.',
    cta: 'Set Up Payments',
    tone: 'amber',
  },
  'in-progress': {
    headline: 'Finish your Stripe onboarding',
    sub: "You started Stripe setup but haven't finished the form. Pick up where you left off.",
    cta: 'Resume',
    tone: 'amber',
  },
  'payouts-disabled': {
    headline: 'Stripe needs your attention',
    sub: 'Stripe has temporarily disabled payouts on your account. Open your Stripe dashboard to resolve.',
    cta: 'Open Stripe',
    tone: 'amber',
  },
  complete: {
    headline: 'Payments connected',
    sub: 'Your bank account is linked. You can publish paid offerings and request payouts.',
    cta: 'Manage / Tax Docs',
    tone: 'green',
  },
};

/**
 * Surfaces Stripe Connect status on the guide dashboard so guides notice
 * the gap before they hit the Payments Publish Gate when trying to publish.
 *
 * Spec: docs/payments-publish-gate.md §6.1.
 */
export function GuidePaymentsChip() {
  const { data, isLoading } = useQuery<ConnectStatus>({
    queryKey: ['guide', 'connect-status'],
    queryFn: async () => {
      const { data } = await api.get('/payments/connect/status');
      return data;
    },
    // Re-fetch when the user comes back from Stripe's hosted onboarding.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  if (isLoading) return null;

  const state = deriveState(data);
  // Hide the chip entirely when fully connected — it's a nudge, not a
  // permanent fixture.
  if (state === 'complete') return null;

  const { headline, sub, cta, tone } = COPY[state];

  const accent = tone === 'amber' ? C.gold : tone === 'green' ? '#5A8A6A' : C.warmGray;
  const tint =
    tone === 'amber' ? 'rgba(232,184,75,0.08)' : tone === 'green' ? '#F0F7F1' : '#FAFAF7';

  return (
    <div
      style={{
        background: tint,
        border: `1px solid ${tone === 'amber' ? 'rgba(232,184,75,0.4)' : 'rgba(90,138,106,0.35)'}`,
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: accent,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.charcoal,
              marginBottom: 2,
            }}
          >
            {headline}
          </div>
          <div style={{ fontSize: 12, color: C.warmGray, lineHeight: 1.5 }}>{sub}</div>
        </div>
      </div>
      <Link
        href="/guide/dashboard/earnings"
        style={{
          flexShrink: 0,
          padding: '8px 16px',
          borderRadius: 6,
          background: accent,
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}
      >
        {cta}
      </Link>
    </div>
  );
}
