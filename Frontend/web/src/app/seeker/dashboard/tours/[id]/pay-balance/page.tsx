'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  C, font, serif, Btn, Panel, formatDate,
} from '@/components/guide/dashboard-ui';
import { StripeProvider } from '@/components/public/checkout/StripeProvider';
import { StripePaymentForm } from '@/components/public/checkout/StripePaymentForm';

interface BalanceInfo {
  bookingId: string;
  bookingReference: string | null;
  tourTitle: string;
  currency: string;
  totalAmount: number;
  depositPaid: number;
  balanceDue: number;
  balanceDueAt: string | null;
}

export default function PayBalancePage() {
  const params = useParams();
  const bookingId = params?.id as string;

  const [info, setInfo] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    api.get(`/soul-tours/bookings/${bookingId}/balance-due`)
      .then((r) => setInfo(r.data))
      .catch((err) => {
        setError(err?.response?.data?.message || 'Unable to load balance information');
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  const startPayment = async () => {
    if (!info) return;
    setCreatingIntent(true);
    try {
      const res = await api.post('/payments/create-intent', {
        amount: info.balanceDue,
        tourBookingId: info.bookingId,
        paymentType: 'BALANCE',
      });
      setClientSecret(res.data.clientSecret);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to initialize payment');
    } finally {
      setCreatingIntent(false);
    }
  };

  const handlePaymentSuccess = (paymentIntentId: string) => {
    // Sync confirmation; webhook is the fallback
    api.post('/payments/confirm-payment', { paymentIntentId }).catch(() => {});
    setPaid(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, padding: 40 }}>Loading…</div>;
  }
  if (error || !info) {
    return (
      <>
        <div style={{ marginBottom: 20 }}>
          <Link
            href={`/seeker/dashboard/tours/${bookingId}`}
            style={{ fontFamily: font, fontSize: 12, color: C.warmGray, textDecoration: 'none' }}
          >
            ← Back to Booking
          </Link>
        </div>
        <Panel title="Cannot pay balance" icon="⚠️">
          <p style={{ fontFamily: font, fontSize: 14, color: C.charcoal, lineHeight: 1.7 }}>
            {error || 'Balance information is unavailable. Balance can only be paid after the deposit has been confirmed.'}
          </p>
        </Panel>
      </>
    );
  }

  if (paid) {
    return (
      <>
        <div style={{ marginBottom: 20 }}>
          <Link
            href={`/seeker/dashboard/tours/${bookingId}`}
            style={{ fontFamily: font, fontSize: 12, color: C.warmGray, textDecoration: 'none' }}
          >
            ← Back to Booking
          </Link>
        </div>
        <div style={{
          background: C.white, border: '1px solid rgba(232,184,75,0.2)', borderRadius: 12,
          padding: 60, textAlign: 'center', maxWidth: 560, margin: '40px auto',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: C.goldPale,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, color: C.green, margin: '0 auto 24px',
          }}>
            ✓
          </div>
          <h1 style={{ fontFamily: serif, fontSize: 32, fontWeight: 400, color: C.charcoal, marginBottom: 10 }}>
            Balance Paid in Full
          </h1>
          <p style={{ fontFamily: font, fontSize: 14, color: C.warmGray, lineHeight: 1.6, marginBottom: 28 }}>
            Thank you! Your booking is now fully paid. You'll receive a receipt by email shortly,
            and your guide will be in touch as your departure date approaches.
          </p>
          <div style={{
            background: C.offWhite, border: '1px solid rgba(232,184,75,0.15)',
            borderRadius: 8, padding: 20, textAlign: 'left', marginBottom: 28,
          }}>
            {[
              { label: 'Tour', value: info.tourTitle },
              { label: 'Reference', value: info.bookingReference || info.bookingId.slice(-8).toUpperCase() },
              { label: 'Total Paid', value: `$${info.totalAmount.toLocaleString()}` },
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                fontFamily: font, fontSize: 13,
                borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.1)' : 'none',
              }}>
                <span style={{ color: C.warmGray }}>{row.label}</span>
                <span style={{ color: C.charcoal, fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
          <Link href={`/seeker/dashboard/tours/${info.bookingId}`} style={{ textDecoration: 'none' }}>
            <Btn variant="primary">Back to Booking</Btn>
          </Link>
        </div>
      </>
    );
  }

  // ─── Main view ────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/seeker/dashboard/tours/${bookingId}`}
          style={{ fontFamily: font, fontSize: 12, color: C.warmGray, textDecoration: 'none' }}
        >
          ← Back to Booking
        </Link>
      </div>

      <h1 style={{ fontFamily: serif, fontSize: 36, fontWeight: 400, color: C.charcoal, marginBottom: 6 }}>
        Pay Remaining Balance
      </h1>
      <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 32 }}>
        {info.tourTitle}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        {/* Left — Payment */}
        <div>
          <Panel title="Payment" icon="💳">
            {!clientSecret ? (
              <>
                <p style={{ fontFamily: font, fontSize: 14, color: C.charcoal, lineHeight: 1.7, marginBottom: 20 }}>
                  Complete your booking by paying the remaining balance of{' '}
                  <strong>${info.balanceDue.toLocaleString()}</strong>.
                  {info.balanceDueAt && (
                    <> This balance is due by <strong>{formatDate(info.balanceDueAt)}</strong>.</>
                  )}
                </p>
                <Btn
                  variant="primary"
                  onClick={startPayment}
                  style={creatingIntent ? { opacity: 0.6, pointerEvents: 'none' } : {}}
                >
                  {creatingIntent ? 'Initializing payment…' : `Pay $${info.balanceDue.toLocaleString()} Now`}
                </Btn>
              </>
            ) : (
              <StripeProvider clientSecret={clientSecret}>
                <StripePaymentForm
                  submitLabel={`Pay $${info.balanceDue.toLocaleString()}`}
                  onSuccess={handlePaymentSuccess}
                  returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/seeker/dashboard/tours/${info.bookingId}/pay-balance`}
                  cancellationNote="By completing this payment, your booking will be marked Fully Paid. Refunds for cancellations are subject to the tour's cancellation policy."
                />
              </StripeProvider>
            )}
          </Panel>
        </div>

        {/* Right — Summary */}
        <aside>
          <div style={{
            background: C.white, border: '1px solid rgba(232,184,75,0.2)',
            borderRadius: 12, padding: 24, position: 'sticky', top: 24,
          }}>
            <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: C.charcoal, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
              Payment Summary
            </div>
            {info.bookingReference && (
              <div style={{
                fontFamily: 'monospace', fontSize: 11, color: C.warmGray,
                padding: '4px 10px', background: C.offWhite, borderRadius: 4,
                border: '1px solid rgba(232,184,75,0.15)', marginBottom: 16, display: 'inline-block',
              }}>
                {info.bookingReference}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: font, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.warmGray }}>
                <span>Total tour cost</span>
                <span style={{ color: C.charcoal }}>${info.totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.warmGray }}>
                <span>Deposit paid</span>
                <span style={{ color: C.green }}>−${info.depositPaid.toLocaleString()}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                paddingTop: 10, borderTop: '1px solid rgba(232,184,75,0.15)',
                fontSize: 16, fontWeight: 500, color: C.charcoal,
              }}>
                <span>Due today</span>
                <span style={{ fontFamily: serif, fontSize: 22, color: C.gold }}>
                  ${info.balanceDue.toLocaleString()}
                </span>
              </div>
              {info.balanceDueAt && (
                <div style={{ fontSize: 11, color: C.warmGray, textAlign: 'right' }}>
                  Originally due {formatDate(info.balanceDueAt)}
                </div>
              )}
            </div>
            <p style={{ fontFamily: font, fontSize: 10, color: C.warmGray, marginTop: 16, lineHeight: 1.5, textAlign: 'center' }}>
              🔒 Secured by Stripe · 256-bit SSL
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
