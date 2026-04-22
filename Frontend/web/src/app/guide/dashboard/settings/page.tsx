'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { C, font, serif, PageHeader, Panel } from '@/components/guide/dashboard-ui';
import { toast } from 'sonner';
import { useSiteConfigOrFallback } from '@/lib/siteConfig';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConnectStatus {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

interface EarningsData {
  balance: { available: number; pending: number; totalEarned: number; totalPaidOut: number };
  stripeConnected: boolean;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuthStore();
  const siteConfig = useSiteConfigOrFallback();
  const commissionPercent = siteConfig.fees.platformCommissionPercent;
  const guideShare = 100 - commissionPercent;
  const minPayout = siteConfig.payouts.minUsd;

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Stripe Connect data
  const { data: connectStatus, isLoading: connectLoading } = useQuery<ConnectStatus>({
    queryKey: ['guide', 'connect-status'],
    queryFn: async () => { const { data } = await api.get('/payments/connect/status'); return data; },
  });

  const { data: earnings } = useQuery<EarningsData>({
    queryKey: ['guide', 'earnings'],
    queryFn: async () => { const { data } = await api.get('/payments/earnings'); return data; },
  });

  // Stripe onboarding
  const connectMutation = useMutation({
    mutationFn: async () => { const { data } = await api.post('/payments/connect/onboard'); return data; },
    onSuccess: (data) => {
      if (data.alreadyOnboarded && data.dashboardUrl) {
        window.open(data.dashboardUrl, '_blank');
      } else if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    },
    onError: () => toast.error('Failed to start Stripe setup'),
  });

  // Change password
  const passwordMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      return data;
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Failed to change password');
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword) { toast.error('Enter your current password'); return; }
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    passwordMutation.mutate();
  };

  const fmtMoney = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <PageHeader title="Account Settings" subtitle="Manage your payment account, security, and preferences." />

      {/* ── PAYMENT SETTINGS ─────────────────────────────────── */}
      <Panel title="Payment Settings" icon="💳">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: font, fontSize: 13, color: C.charcoal, lineHeight: 1.7, marginBottom: 16 }}>
            Connect your Stripe account to receive payouts from your services, events, and tours.
            Spiritual California uses <strong>Stripe Connect</strong> to securely transfer your earnings
            directly to your bank account or debit card.
          </div>

          {/* Connection Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <StatusBadge label="Connected" value={connectStatus?.connected} loading={connectLoading} />
            <StatusBadge label="Charges Enabled" value={connectStatus?.chargesEnabled} loading={connectLoading} />
            <StatusBadge label="Payouts Enabled" value={connectStatus?.payoutsEnabled} loading={connectLoading} />
            <StatusBadge label="Details Submitted" value={connectStatus?.detailsSubmitted} loading={connectLoading} />
          </div>

          {/* Balance summary */}
          {earnings && (
            <div style={{
              background: C.offWhite, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 8,
              padding: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20,
            }}>
              <BalanceItem label="Available Balance" value={fmtMoney(earnings.balance.available)} highlight />
              <BalanceItem label="Pending" value={fmtMoney(earnings.balance.pending)} />
              <BalanceItem label="Total Earned" value={fmtMoney(earnings.balance.totalEarned)} />
              <BalanceItem label="Total Paid Out" value={fmtMoney(earnings.balance.totalPaidOut)} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {connectStatus?.connected ? (
              <>
                <ActionButton onClick={() => connectMutation.mutate()} loading={connectMutation.isPending} variant="secondary">
                  Open Stripe Dashboard
                </ActionButton>
                <ActionButton onClick={() => connectMutation.mutate()} loading={connectMutation.isPending} variant="secondary">
                  Update Bank Account
                </ActionButton>
              </>
            ) : (
              <ActionButton onClick={() => connectMutation.mutate()} loading={connectMutation.isPending}>
                Set Up Stripe Connect
              </ActionButton>
            )}
          </div>

          {!connectStatus?.connected && (
            <div style={{ marginTop: 16, padding: 14, background: C.goldPale, borderRadius: 6, fontFamily: font, fontSize: 12, color: C.charcoal, lineHeight: 1.7 }}>
              <strong>What you&apos;ll need:</strong> A valid government-issued ID, your bank account or debit card details,
              and a few minutes to complete Stripe&apos;s secure verification process. Your financial information is
              never stored on our servers — it goes directly to Stripe.
            </div>
          )}

          {connectStatus?.connected && (
            <div style={{ marginTop: 16, padding: 14, background: '#E8F5E9', borderRadius: 6, fontFamily: font, fontSize: 12, color: '#2E7D32', lineHeight: 1.7 }}>
              Your Stripe account is fully set up. Earnings from bookings, events, and tours are automatically
              credited to your available balance. Request payouts anytime from your{' '}
              <a href="/guide/dashboard/earnings" style={{ color: '#1B5E20', fontWeight: 600 }}>Earnings & Payouts</a> page.
            </div>
          )}
        </div>

        {/* How payouts work */}
        <div style={{ borderTop: '1px solid rgba(232,184,75,0.15)', paddingTop: 20 }}>
          <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 12 }}>How Payouts Work</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { step: '1', title: 'Seeker Pays', desc: `Payment processed via Stripe. ${commissionPercent}% platform fee deducted.` },
              { step: '2', title: 'Balance Credited', desc: `Your ${guideShare}% earnings are added to your available balance instantly.` },
              { step: '3', title: 'Request Payout', desc: `Request a transfer from your Earnings page ($${minPayout} minimum).` },
              { step: '4', title: 'Funds Transferred', desc: 'Admin processes your request. Arrives in 3-5 business days.' },
            ].map((s) => (
              <div key={s.step} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: C.gold, color: C.charcoal,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: font, fontSize: 14, fontWeight: 700, margin: '0 auto 8px',
                }}>{s.step}</div>
                <div style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: C.charcoal, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* ── ACCOUNT SECURITY ─────────────────────────────────── */}
      <Panel title="Account Security" icon="🔒">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Account info */}
          <div>
            <SectionLabel>Account Information</SectionLabel>
            <div style={{ marginTop: 12 }}>
              <InfoRow label="Name" value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
              <InfoRow label="Email" value={user?.email ?? '—'} />
              <InfoRow label="Email Verified" value={user?.isEmailVerified ? 'Yes' : 'No'} badge={user?.isEmailVerified ? 'verified' : 'unverified'} />
              <InfoRow label="Roles" value={user?.roles?.join(', ') ?? '—'} />
            </div>
          </div>

          {/* Change password */}
          <div>
            <SectionLabel>Change Password</SectionLabel>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <FieldLabel>Current Password</FieldLabel>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  style={inputStyle}
                />
              </div>
              <div>
                <FieldLabel>New Password</FieldLabel>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  style={inputStyle}
                />
              </div>
              <div>
                <FieldLabel>Confirm New Password</FieldLabel>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  style={inputStyle}
                />
              </div>
              <ActionButton onClick={handleChangePassword} loading={passwordMutation.isPending}>
                Update Password
              </ActionButton>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── NOTIFICATION PREFERENCES ─────────────────────────── */}
      <Panel title="Notification Preferences" icon="🔔">
        <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 16 }}>
          Manage which email notifications you receive from Spiritual California.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <NotifToggle label="New Booking Alerts" desc="Get notified when a seeker books your service, event, or tour." defaultOn />
          <NotifToggle label="Payout Confirmations" desc="Email confirmation when a payout is processed to your bank account." defaultOn />
          <NotifToggle label="Review Notifications" desc="Get notified when a seeker leaves a review on your profile." defaultOn />
          <NotifToggle label="Platform Updates" desc="Product updates, new features, and important announcements." defaultOn />
          <NotifToggle label="Marketing & Promotions" desc="Promotional opportunities, featured guide spotlights, and growth tips." defaultOn={false} />
        </div>
      </Panel>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ label, value, loading }: { label: string; value?: boolean; loading: boolean }) {
  return (
    <div style={{ background: C.white, border: '1px solid rgba(232,184,75,0.12)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: font, fontSize: 11, color: C.warmGray }}>{label}</span>
      {loading ? (
        <span style={{ width: 40, height: 18, background: '#f0f0f0', borderRadius: 4, display: 'inline-block' }} />
      ) : (
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
          background: value ? '#E8F5E9' : '#FFF3E0',
          color: value ? '#2E7D32' : '#E65100',
        }}>
          {value ? 'Yes' : 'No'}
        </span>
      )}
    </div>
  );
}

function BalanceItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: font, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: serif, fontSize: highlight ? 28 : 20, fontWeight: 500, color: highlight ? C.gold : C.charcoal }}>{value}</div>
    </div>
  );
}

function ActionButton({ children, onClick, loading, variant }: { children: React.ReactNode; onClick: () => void; loading?: boolean; variant?: 'secondary' }) {
  const isSecondary = variant === 'secondary';
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '12px 24px', borderRadius: 8, border: isSecondary ? `1px solid rgba(232,184,75,0.3)` : 'none',
        background: loading ? '#C4BDB5' : isSecondary ? C.white : C.charcoal,
        color: loading ? C.white : isSecondary ? C.charcoal : C.gold,
        fontFamily: font, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
        cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
      }}
    >
      {loading ? 'Processing...' : children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, fontWeight: 600 }}>{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontFamily: font, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 5 }}>{children}</label>;
}

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: 'verified' | 'unverified' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(232,184,75,0.08)' }}>
      <span style={{ fontFamily: font, fontSize: 12, color: C.warmGray }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: font, fontSize: 13, color: C.charcoal }}>{value}</span>
        {badge && (
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
            background: badge === 'verified' ? '#E8F5E9' : '#FFF3E0',
            color: badge === 'verified' ? '#2E7D32' : '#E65100',
          }}>
            {badge === 'verified' ? 'Verified' : 'Unverified'}
          </span>
        )}
      </div>
    </div>
  );
}

function NotifToggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn ?? true);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 0', borderBottom: '1px solid rgba(232,184,75,0.08)',
    }}>
      <div>
        <div style={{ fontFamily: font, fontSize: 13, fontWeight: 500, color: C.charcoal }}>{label}</div>
        <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray, marginTop: 2 }}>{desc}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: on ? C.gold : '#D1D5DB', position: 'relative', transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: C.white,
          position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(232,184,75,0.25)',
  borderRadius: 6, padding: '11px 14px', fontSize: 13, fontFamily: font,
  background: C.white, color: C.charcoal, outline: 'none', width: '100%',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};
