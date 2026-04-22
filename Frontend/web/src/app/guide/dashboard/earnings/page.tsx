'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { C, font, serif, PageHeader, Panel, EmptyState } from '@/components/guide/dashboard-ui';
import { toast } from 'sonner';
import { useSiteConfigOrFallback } from '@/lib/siteConfig';

interface EarningsData {
  balance: { available: number; pending: number; totalEarned: number; totalPaidOut: number };
  recentPayments: Array<{
    id: string; amount: string | number; guideAmount: string | number; platformFee: string | number;
    paymentType: string; paymentMethod: string | null; createdAt: string; status: string;
  }>;
  stripeConnected: boolean;
}

interface PayoutRequest {
  id: string; amount: string | number; currency: string; status: string;
  stripePayoutId: string | null; processedAt: string | null; createdAt: string;
}

function fmtMoney(v: number | string) {
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  SUCCEEDED: { bg: '#E8F5E9', color: '#2E7D32' },
  PENDING: { bg: '#FFF3E0', color: '#E65100' },
  PROCESSING: { bg: '#E3F2FD', color: '#1565C0' },
  COMPLETED: { bg: '#E8F5E9', color: '#2E7D32' },
  FAILED: { bg: '#FFEBEE', color: '#C62828' },
};

export default function EarningsPage() {
  const queryClient = useQueryClient();
  const [payoutAmount, setPayoutAmount] = useState('');
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const siteConfig = useSiteConfigOrFallback();
  const commissionPercent = siteConfig.fees.platformCommissionPercent;
  const minPayout = siteConfig.payouts.minUsd;

  const { data: earnings, isLoading } = useQuery<EarningsData>({
    queryKey: ['guide', 'earnings'],
    queryFn: async () => { const { data } = await api.get('/payments/earnings'); return data; },
  });

  const { data: payoutHistory } = useQuery<PayoutRequest[]>({
    queryKey: ['guide', 'payout-history'],
    queryFn: async () => { const { data } = await api.get('/payments/payout-history'); return data; },
  });

  const { data: connectStatus } = useQuery({
    queryKey: ['guide', 'connect-status'],
    queryFn: async () => { const { data } = await api.get('/payments/connect/status'); return data; },
  });

  const connectMutation = useMutation({
    mutationFn: async () => { const { data } = await api.post('/payments/connect/onboard'); return data; },
    onSuccess: (data) => {
      if (data.alreadyOnboarded && data.dashboardUrl) {
        window.open(data.dashboardUrl, '_blank');
      } else if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    },
    onError: () => toast.error('Failed to start Stripe onboarding'),
  });

  const payoutMutation = useMutation({
    mutationFn: async (amount: number) => { const { data } = await api.post('/payments/payout', { amount }); return data; },
    onSuccess: () => {
      toast.success('Payout requested! Admin will process your transfer.');
      setPayoutAmount('');
      setShowPayoutForm(false);
      queryClient.invalidateQueries({ queryKey: ['guide', 'earnings'] });
      queryClient.invalidateQueries({ queryKey: ['guide', 'payout-history'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Payout request failed';
      toast.error(msg);
    },
  });

  const handlePayout = () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount < minPayout) { toast.error(`Minimum payout is $${minPayout}`); return; }
    if (amount > (earnings?.balance.available ?? 0)) { toast.error('Insufficient balance'); return; }
    payoutMutation.mutate(amount);
  };

  const available = earnings?.balance.available ?? 0;
  const totalEarned = earnings?.balance.totalEarned ?? 0;
  const totalPaidOut = earnings?.balance.totalPaidOut ?? 0;

  return (
    <div>
      <PageHeader title="Earnings & Payouts" subtitle="Track your income and transfer funds to your bank account." />

      {/* Balance Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, #2C2420 0%, #4A3C30 100%)', borderRadius: 12,
        padding: 32, color: C.white, marginBottom: 28,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Available Balance</div>
            <div style={{ fontFamily: serif, fontSize: 48, fontWeight: 400, color: C.gold, lineHeight: 1 }}>
              {isLoading ? '...' : fmtMoney(available)}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Total Earned</div>
            <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 400, color: 'rgba(255,255,255,0.8)', lineHeight: 1 }}>
              {isLoading ? '...' : fmtMoney(totalEarned)}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Total Paid Out</div>
            <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 400, color: 'rgba(255,255,255,0.8)', lineHeight: 1 }}>
              {isLoading ? '...' : fmtMoney(totalPaidOut)}
            </div>
          </div>
        </div>

        <div style={{ fontFamily: font, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
          From services, events, and tours on Spiritual California. Platform commission: {commissionPercent}%.
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {earnings?.stripeConnected ? (
            <>
              <button
                onClick={() => setShowPayoutForm(!showPayoutForm)}
                style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: C.gold, color: C.charcoal, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                Request Payout
              </button>
              <button
                onClick={() => connectMutation.mutate()}
                style={{ padding: '12px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: C.white, fontFamily: font, fontSize: 13, cursor: 'pointer' }}
              >
                Stripe Dashboard
              </button>
            </>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: C.gold, color: C.charcoal, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              {connectMutation.isPending ? 'Setting up...' : 'Set Up Stripe Connect'}
            </button>
          )}
        </div>

        {/* Payout Request Form */}
        {showPayoutForm && (
          <div style={{ marginTop: 20, padding: 20, background: 'rgba(255,255,255,0.08)', borderRadius: 8, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                Amount (min ${minPayout})
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>$</span>
                <input
                  type="number"
                  min={minPayout}
                  step="0.01"
                  max={available}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '12px 14px 12px 28px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: C.white, fontFamily: font, fontSize: 15, outline: 'none' }}
                />
              </div>
            </div>
            <button
              onClick={() => setPayoutAmount(String(available))}
              style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontFamily: font, fontSize: 12, cursor: 'pointer' }}
            >
              Max ({fmtMoney(available)})
            </button>
            <button
              onClick={handlePayout}
              disabled={payoutMutation.isPending}
              style={{ padding: '12px 24px', borderRadius: 6, border: 'none', background: '#5A8A6A', color: C.white, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {payoutMutation.isPending ? 'Requesting...' : 'Submit Request'}
            </button>
          </div>
        )}

        {!earnings?.stripeConnected && (
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(232,184,75,0.15)', borderRadius: 6, fontFamily: font, fontSize: 12, color: C.goldLight }}>
            Connect your Stripe account to receive payouts. You&apos;ll need a bank account or debit card.
          </div>
        )}
      </div>

      {/* Stripe Connect Status */}
      {connectStatus && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          <StatusCard label="Stripe Connected" value={connectStatus.connected ? 'Yes' : 'No'} ok={connectStatus.connected} />
          <StatusCard label="Charges Enabled" value={connectStatus.chargesEnabled ? 'Yes' : 'No'} ok={connectStatus.chargesEnabled} />
          <StatusCard label="Payouts Enabled" value={connectStatus.payoutsEnabled ? 'Yes' : 'No'} ok={connectStatus.payoutsEnabled} />
        </div>
      )}

      {/* Recent Transactions */}
      <Panel title="Recent Transactions" icon="📊">
        {!earnings?.recentPayments?.length ? (
          <EmptyState message="No transactions yet. Earnings will appear here once bookings or product sales occur." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(232,184,75,0.15)', textAlign: 'left' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Your Earnings</th>
                  <th style={thStyle}>Platform Fee</th>
                  <th style={thStyle}>Method</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {earnings.recentPayments.map((p) => {
                  const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.PENDING;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(232,184,75,0.06)' }}>
                      <td style={tdStyle}>{fmtDate(p.createdAt)}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: C.goldPale, color: C.charcoal, fontSize: 11, fontWeight: 500 }}>{p.paymentType}</span>
                      </td>
                      <td style={tdStyle}>{fmtMoney(p.amount)}</td>
                      <td style={{ ...tdStyle, color: '#2E7D32', fontWeight: 600 }}>{fmtMoney(p.guideAmount)}</td>
                      <td style={{ ...tdStyle, color: C.warmGray }}>{fmtMoney(p.platformFee)}</td>
                      <td style={{ ...tdStyle, color: C.warmGray }}>{p.paymentMethod ?? '—'}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600 }}>{p.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Payout History */}
      <Panel title="Payout Requests" icon="💸">
        {!payoutHistory?.length ? (
          <EmptyState message={`No payout requests yet. Request a payout when your available balance is $${minPayout} or more.`} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(232,184,75,0.15)', textAlign: 'left' }}>
                  <th style={thStyle}>Date Requested</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Processed</th>
                  <th style={thStyle}>Transfer ID</th>
                </tr>
              </thead>
              <tbody>
                {payoutHistory.map((p) => {
                  const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.PENDING;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(232,184,75,0.06)' }}>
                      <td style={tdStyle}>{fmtDate(p.createdAt)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtMoney(p.amount)}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600 }}>{p.status}</span>
                      </td>
                      <td style={{ ...tdStyle, color: C.warmGray }}>{p.processedAt ? fmtDate(p.processedAt) : '—'}</td>
                      <td style={{ ...tdStyle, color: C.warmGray, fontFamily: 'monospace', fontSize: 11 }}>{p.stripePayoutId ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* How it works info */}
      <div style={{ background: C.goldPale, border: '1px solid rgba(232,184,75,0.2)', borderRadius: 12, padding: 24, fontFamily: font, fontSize: 13, color: C.charcoal, lineHeight: 1.8 }}>
        <strong style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>How payouts work</strong>
        <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
          <li>When a seeker pays for your service, tour, or event, your earnings (minus {commissionPercent}% platform fee) are credited to your available balance.</li>
          <li>Request a payout anytime your balance is ${minPayout} or more.</li>
          <li>The admin team reviews and processes your payout via Stripe Connect.</li>
          <li>Funds typically arrive in your bank account within 3–5 business days after processing.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ background: C.white, border: '1px solid rgba(232,184,75,0.12)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: font, fontSize: 12, color: C.warmGray }}>{label}</span>
      <span style={{ padding: '3px 10px', borderRadius: 4, background: ok ? '#E8F5E9' : '#FFF3E0', color: ok ? '#2E7D32' : '#E65100', fontSize: 11, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray, fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: '12px', color: C.charcoal };
