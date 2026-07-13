'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, serif, PageHeader, Panel, Btn } from '@/components/guide/dashboard-ui';

interface SubscriptionStatus {
  plans: {
    monthly: { amount: number; interval: string };
    annual: { amount: number; interval: string; savingsVsMonthly: number };
  };
  freePeriodActive: boolean;
  freePeriodEndsAt: string;
  freePeriodDaysLeft: number;
  subscription: {
    status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED';
    currentPeriodEnd: string;
    cancelledAt: string | null;
  } | null;
}

const STANDARD_FEATURES = [
  'Full profile listing',
  'Unlimited blog posts (1/day)',
  'Services & products listing',
  'Calendly booking integration',
  'Verified badge eligibility',
  'Events listing',
];
const ANNUAL_FEATURES = [
  'Everything in Standard',
  'Priority placement in search',
  'Featured in monthly newsletter',
];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  TRIALING: 'Free trial',
  PAST_DUE: 'Payment due',
  CANCELLED: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: C.green,
  TRIALING: C.green,
  PAST_DUE: '#E65100',
  CANCELLED: C.warmGray,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function SubscriptionPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['guide', 'subscription-status'],
    queryFn: async () => { const { data } = await api.get('/payments/subscription/status'); return data; },
  });

  // Surface the Stripe redirect outcome (?subscription=success|cancelled) once,
  // then refresh status so the page reflects the new subscription.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('subscription');
    if (!outcome) return;
    if (outcome === 'success') {
      toast.success('Subscription started! It may take a moment to activate.');
      queryClient.invalidateQueries({ queryKey: ['guide', 'subscription-status'] });
    } else if (outcome === 'cancelled') {
      toast('Checkout cancelled — no charge was made.');
    }
    window.history.replaceState({}, '', '/guide/dashboard/subscription');
  }, [queryClient]);

  const checkoutMutation = useMutation({
    mutationFn: async (plan: 'monthly' | 'annual') => {
      const { data } = await api.post('/payments/subscription/checkout', { plan });
      return data;
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Could not start checkout');
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => { const { data } = await api.post('/payments/subscription/portal'); return data; },
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: () => toast.error('Could not open billing portal'),
  });

  const sub = data?.subscription;
  const hasActivePlan = !!sub && (sub.status === 'ACTIVE' || sub.status === 'TRIALING' || sub.status === 'PAST_DUE');
  const busy = checkoutMutation.isPending || portalMutation.isPending;

  return (
    <div>
      <PageHeader title="Subscription Plan" subtitle="Your listing plan on Spiritual California." />

      {/* Current status banner */}
      {isLoading ? (
        <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 28 }}>Loading your plan…</div>
      ) : hasActivePlan && sub ? (
        <div style={{ border: `2px solid ${C.gold}`, borderRadius: 12, padding: 24, background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal }}>Standard Listing</div>
            <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginTop: 3 }}>
              {sub.status === 'TRIALING'
                ? `Free until ${fmtDate(sub.currentPeriodEnd)} — then billing begins.`
                : sub.cancelledAt
                  ? `Cancels at end of period — access until ${fmtDate(sub.currentPeriodEnd)}.`
                  : `Renews ${fmtDate(sub.currentPeriodEnd)}.`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ padding: '5px 14px', borderRadius: 20, background: STATUS_COLOR[sub.status], color: C.white, fontFamily: font, fontSize: 11, fontWeight: 500 }}>
              {STATUS_LABEL[sub.status]}
            </span>
            <Btn variant="secondary" onClick={() => portalMutation.mutate()} disabled={busy}>
              {portalMutation.isPending ? 'Opening…' : 'Manage Billing'}
            </Btn>
          </div>
        </div>
      ) : (
        <div style={{ border: `2px solid ${C.gold}`, borderRadius: 12, padding: 24, background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal }}>Free Listing Period</div>
            <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginTop: 3 }}>
              {data?.freePeriodActive
                ? `Free until ${fmtDate(data.freePeriodEndsAt)} · ${data.freePeriodDaysLeft} days left`
                : 'Your free period has ended — choose a plan below to keep your listing live.'}
            </div>
          </div>
          <span style={{ padding: '5px 14px', borderRadius: 20, background: data?.freePeriodActive ? C.green : C.warmGray, color: C.white, fontFamily: font, fontSize: 11, fontWeight: 500 }}>
            {data?.freePeriodActive ? 'Active' : 'Ended'}
          </span>
        </div>
      )}

      <Panel title={hasActivePlan ? 'Your Plan' : 'After Your Free Period'} icon="⭐">
        <div className="sc-form2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Standard (monthly) */}
          <div style={{ padding: 24, border: `2px solid ${C.gold}`, borderRadius: 12, background: C.goldPale }}>
            <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal, marginBottom: 6 }}>Standard Listing</div>
            <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 400, color: C.gold, marginBottom: 12 }}>$50<span style={{ fontSize: 16, color: C.warmGray }}>/month</span></div>
            {STANDARD_FEATURES.map(f => (
              <div key={f} style={{ fontFamily: font, fontSize: 13, color: C.charcoal, marginBottom: 8 }}>✓ {f}</div>
            ))}
            <Btn
              style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}
              onClick={() => checkoutMutation.mutate('monthly')}
              disabled={busy || hasActivePlan}
            >
              {hasActivePlan ? 'Current Plan' : checkoutMutation.isPending ? 'Redirecting…' : 'Subscribe — $50/month'}
            </Btn>
          </div>

          {/* Annual */}
          <div style={{ padding: 24, border: '1px solid rgba(240,120,20,0.2)', borderRadius: 12 }}>
            <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal, marginBottom: 6 }}>Annual Plan</div>
            <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 400, color: C.charcoal, marginBottom: 12 }}>$480<span style={{ fontSize: 16, color: C.warmGray }}>/year</span></div>
            <div style={{ fontFamily: font, fontSize: 12, color: C.green, fontWeight: 500, marginBottom: 12 }}>Save $120 vs. monthly</div>
            {ANNUAL_FEATURES.map(f => (
              <div key={f} style={{ fontFamily: font, fontSize: 13, color: C.charcoal, marginBottom: 8 }}>✓ {f}</div>
            ))}
            <Btn
              variant="secondary"
              style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}
              onClick={() => checkoutMutation.mutate('annual')}
              disabled={busy || hasActivePlan}
            >
              {hasActivePlan ? 'Current Plan' : checkoutMutation.isPending ? 'Redirecting…' : 'Subscribe — $480/year'}
            </Btn>
          </div>
        </div>
        <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray, marginTop: 16 }}>
          Secure checkout via Stripe. If you subscribe during your free period, billing only begins once it ends.
        </div>
      </Panel>
    </div>
  );
}
