'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, serif, Panel, Btn } from '@/components/guide/dashboard-ui';

const statusMap: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING: { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80', label: 'Pending Payment' },
  CONFIRMED: { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7', label: 'Confirmed' },
  COMPLETED: { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9', label: 'Completed' },
  CANCELLED: { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A', label: 'Cancelled' },
  NO_SHOW: { bg: '#F5F5F5', color: '#757575', border: '#E0E0E0', label: 'No Show' },
};

const paymentStatusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: '#E65100' },
  SUCCEEDED: { label: 'Paid', color: '#2E7D32' },
  FAILED: { label: 'Failed', color: '#C62828' },
  REFUNDED: { label: 'Refunded', color: '#1565C0' },
  PARTIALLY_REFUNDED: { label: 'Partially Refunded', color: '#1565C0' },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }),
  };
}

function formatDuration(min: number) {
  if (min < 60) return `${min} minutes`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
}

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    api.get(`/bookings/${bookingId}`)
      .then(r => setBooking(r.data))
      .catch(() => toast.error('Booking not found'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.patch(`/bookings/${bookingId}/cancel`, { reason: cancelReason || 'Cancelled by seeker' });
      toast.success('Booking cancelled');
      setShowCancelModal(false);
      setBooking((prev: any) => ({ ...prev, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancellationReason: cancelReason }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  if (!booking) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Booking not found.</div>;

  const status = statusMap[booking.status] || statusMap.PENDING;
  const start = booking.slot?.startTime ? formatDateTime(booking.slot.startTime) : null;
  const end = booking.slot?.endTime ? formatDateTime(booking.slot.endTime) : null;
  const payment = booking.payment;
  const payStatus = payment ? (paymentStatusMap[payment.status] || paymentStatusMap.PENDING) : null;
  const now = new Date();
  const slotStart = booking.slot?.startTime ? new Date(booking.slot.startTime) : null;
  const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status) && slotStart && slotStart > now;
  const guide = booking.service?.guide;

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: '20px' }}>
        <a href="/seeker/dashboard/bookings" style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, textDecoration: 'none' }}>
          ← Back to My Bookings
        </a>
      </div>

      {/* Header with status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: serif, fontSize: '32px', fontWeight: 400, color: C.charcoal, marginBottom: '6px' }}>
            {booking.service?.name}
          </h1>
          <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>
            Booking Reference: <span style={{ fontFamily: 'monospace', fontSize: '12px', color: C.charcoal }}>{bookingId.slice(-10).toUpperCase()}</span>
          </p>
        </div>
        <span style={{
          padding: '8px 20px', borderRadius: '24px', fontFamily: font, fontSize: '12px', fontWeight: 500,
          background: status.bg, color: status.color, border: `1.5px solid ${status.border}`,
        }}>
          {status.label}
        </span>
      </div>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', alignItems: 'start' }}>

        {/* Left column — Booking Details */}
        <div>
          {/* Session Details */}
          <Panel title="Session Details" icon="📋">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {[
                { label: 'Service', value: booking.service?.name },
                { label: 'Duration', value: booking.service?.durationMin ? formatDuration(booking.service.durationMin) : '—' },
                { label: 'Format', value: booking.service?.type === 'IN_PERSON' ? 'In-Person' : booking.service?.type === 'VIRTUAL' ? 'Online (Zoom)' : 'Online or In-Person' },
                { label: 'Date', value: start?.date || '—' },
                { label: 'Time', value: start ? `${start.time}${end ? ` – ${end.time}` : ''}` : '—' },
                { label: 'Amount', value: `$${Number(booking.totalAmount).toFixed(2)} ${booking.currency}`, highlight: true },
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                }}>
                  <span style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>{row.label}</span>
                  <span style={{
                    fontFamily: font, fontSize: '13px', fontWeight: row.highlight ? 600 : 400,
                    color: row.highlight ? C.gold : C.charcoal,
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Session Notes */}
          {booking.notes && (
            <Panel title="Session Notes" icon="📝">
              <p style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {booking.notes}
              </p>
            </Panel>
          )}

          {/* Payment Details */}
          <Panel title="Payment Information" icon="💳">
            {payment ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {[
                  { label: 'Payment Status', value: payStatus?.label, color: payStatus?.color },
                  { label: 'Amount Charged', value: `$${Number(payment.amount).toFixed(2)} ${payment.currency}` },
                  { label: 'Payment Method', value: payment.paymentMethod ? payment.paymentMethod.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Card' },
                  { label: 'Payment Date', value: new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) },
                  ...(payment.refundedAmount ? [{ label: 'Refunded', value: `$${Number(payment.refundedAmount).toFixed(2)}` }] : []),
                  { label: 'Transaction ID', value: payment.stripePaymentIntentId?.slice(-12)?.toUpperCase(), mono: true },
                ].map((row, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                  }}>
                    <span style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>{row.label}</span>
                    <span style={{
                      fontFamily: row.mono ? 'monospace' : font,
                      fontSize: row.mono ? '11px' : '12px',
                      fontWeight: 500,
                      color: row.color || C.charcoal,
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>No payment information available.</p>
            )}
          </Panel>

          {/* Cancellation Info (if cancelled) */}
          {booking.status === 'CANCELLED' && (
            <Panel title="Cancellation Details" icon="❌">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {[
                  { label: 'Cancelled On', value: booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—' },
                  { label: 'Reason', value: booking.cancellationReason || 'No reason provided' },
                ].map((row, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                  }}>
                    <span style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>{row.label}</span>
                    <span style={{ fontFamily: font, fontSize: '12px', color: C.charcoal }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Actions */}
          {canCancel && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <Btn variant="danger" onClick={() => setShowCancelModal(true)}>Cancel Booking</Btn>
              <a href={`/book/${guide?.slug}`} style={{
                display: 'inline-flex', alignItems: 'center', padding: '10px 22px', borderRadius: '6px',
                fontFamily: font, fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                background: 'transparent', color: C.charcoal, border: '1.5px solid rgba(232,184,75,0.5)',
                textDecoration: 'none',
              }}>
                Reschedule
              </a>
            </div>
          )}
        </div>

        {/* Right column — Guide Card */}
        <div>
          <Panel title="Your Practitioner" icon="🧘">
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
              {guide?.user?.avatarUrl ? (
                <img src={guide.user.avatarUrl} alt={guide.displayName} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(232,184,75,0.3)' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: C.gold, border: '2px solid rgba(232,184,75,0.3)' }}>
                  {guide?.displayName?.[0] || '?'}
                </div>
              )}
              <div>
                <div style={{ fontFamily: serif, fontSize: '18px', fontWeight: 500, color: C.charcoal }}>{guide?.displayName}</div>
                {guide?.slug && (
                  <a href={`/guides/${guide.slug}`} style={{ fontFamily: font, fontSize: '11px', color: C.gold, textDecoration: 'none' }}>
                    View Profile →
                  </a>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {guide?.slug && (
                <>
                  <a href={`/book/${guide.slug}`} style={{
                    flex: 1, textAlign: 'center', padding: '10px', borderRadius: '6px',
                    fontFamily: font, fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                    background: C.gold, color: C.white, textDecoration: 'none',
                  }}>
                    Book Again
                  </a>
                  <a href={`/guides/${guide.slug}`} style={{
                    flex: 1, textAlign: 'center', padding: '10px', borderRadius: '6px',
                    fontFamily: font, fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                    background: 'transparent', color: C.charcoal, border: '1.5px solid rgba(232,184,75,0.3)',
                    textDecoration: 'none',
                  }}>
                    Profile
                  </a>
                </>
              )}
            </div>
          </Panel>

          {/* Cancellation Policy */}
          <div style={{
            background: C.goldPale, border: '1px solid rgba(232,184,75,0.2)',
            borderRadius: '8px', padding: '18px', fontFamily: font, fontSize: '12px',
            color: C.charcoal, lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>
              Cancellation Policy
            </div>
            Full refund if cancelled 48+ hours before the session. 50% refund within 48 hours. No refund for no-shows. You may reschedule once at no charge up to 24 hours before the session.
          </div>

          {/* Booking created date */}
          <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, marginTop: '16px', textAlign: 'center' }}>
            Booked on {new Date(booking.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div onClick={() => setShowCancelModal(false)} style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(58,53,48,0.6)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.white, borderRadius: '16px', padding: '36px', width: '90%', maxWidth: '460px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontFamily: serif, fontSize: '24px', fontWeight: 500, color: C.charcoal, marginBottom: '12px' }}>
              Cancel Booking?
            </h3>
            <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6, marginBottom: '20px' }}>
              Are you sure you want to cancel your <strong>{booking.service?.name}</strong> session with <strong>{guide?.displayName}</strong>?
              {slotStart && (slotStart.getTime() - now.getTime()) < 48 * 60 * 60 * 1000 && (
                <span style={{ display: 'block', color: C.red, marginTop: '8px' }}>
                  This session is within 48 hours — only a 50% refund will apply.
                </span>
              )}
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.warmGray, fontWeight: 500, display: 'block', marginBottom: '6px' }}>
                Reason (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Let your practitioner know why you're cancelling..."
                style={{
                  width: '100%', fontFamily: font, fontSize: '13px', color: C.charcoal,
                  background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)',
                  borderRadius: '8px', padding: '10px 14px', outline: 'none', resize: 'vertical', minHeight: '80px',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => setShowCancelModal(false)}>Keep Booking</Btn>
              <Btn variant="danger" onClick={handleCancel} style={cancelling ? { opacity: 0.6 } : {}}>
                {cancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
