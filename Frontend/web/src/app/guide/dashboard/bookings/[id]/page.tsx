'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, serif, formatPrice, Panel, Btn } from '@/components/guide/dashboard-ui';

const statusMap: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING: { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80', label: 'Pending Payment' },
  CONFIRMED: { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7', label: 'Confirmed' },
  COMPLETED: { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9', label: 'Completed' },
  CANCELLED: { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A', label: 'Cancelled' },
  NO_SHOW: { bg: '#F5F5F5', color: '#757575', border: '#E0E0E0', label: 'No Show' },
};

export default function GuideBookingDetailPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) return;
    api.get(`/bookings/${bookingId}`)
      .then(r => setBooking(r.data))
      .catch(() => toast.error('Booking not found'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const updateStatus = async (action: 'confirm' | 'complete' | 'cancel') => {
    if (action === 'cancel' && !confirm('Cancel this booking? The seeker will be refunded.')) return;
    try {
      if (action === 'cancel') await api.patch(`/bookings/${bookingId}/cancel`, { reason: 'Cancelled by guide' });
      else await api.patch(`/bookings/${bookingId}/${action}`);
      toast.success(action === 'confirm' ? 'Booking confirmed' : action === 'complete' ? 'Marked as completed' : 'Booking cancelled');
      // Refresh
      const r = await api.get(`/bookings/${bookingId}`);
      setBooking(r.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${action}`);
    }
  };

  if (loading) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  if (!booking) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Booking not found.</div>;

  const status = statusMap[booking.status] || statusMap.PENDING;
  const seeker = booking.seeker?.user;
  const service = booking.service;
  const slot = booking.slot;
  const payment = booking.payment;
  const start = slot?.startTime ? new Date(slot.startTime) : null;
  const end = slot?.endTime ? new Date(slot.endTime) : null;
  const now = new Date();
  const isPending = booking.status === 'PENDING';
  const isConfirmed = booking.status === 'CONFIRMED';
  const canComplete = isConfirmed && start && start <= now;

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: '20px' }}>
        <a href="/guide/dashboard/bookings" style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, textDecoration: 'none' }}>
          ← Back to Bookings
        </a>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: serif, fontSize: '32px', fontWeight: 400, color: C.charcoal, marginBottom: '4px' }}>
            Booking Details
          </h1>
          <p style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>
            Reference: <span style={{ fontFamily: 'monospace', color: C.charcoal }}>{bookingId.slice(-10).toUpperCase()}</span>
          </p>
        </div>
        <span style={{
          padding: '8px 20px', borderRadius: '24px', fontFamily: font, fontSize: '12px', fontWeight: 500,
          background: status.bg, color: status.color, border: `1.5px solid ${status.border}`,
        }}>
          {status.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', alignItems: 'start' }}>
        {/* Left — Details */}
        <div>
          {/* Client Info */}
          <Panel title="Client Information" icon="👤">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              {seeker?.avatarUrl ? (
                <img src={seeker.avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(232,184,75,0.3)' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: C.gold, border: '2px solid rgba(232,184,75,0.3)' }}>
                  {seeker?.firstName?.[0] || '?'}
                </div>
              )}
              <div>
                <div style={{ fontFamily: font, fontSize: '16px', fontWeight: 500, color: C.charcoal }}>
                  {seeker?.firstName} {seeker?.lastName}
                </div>
                <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>{seeker?.email}</div>
                {seeker?.phone && <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>{seeker.phone}</div>}
              </div>
            </div>
          </Panel>

          {/* Session Details */}
          <Panel title="Session Details" icon="📋">
            {[
              { label: 'Service', value: service?.name },
              { label: 'Duration', value: service?.durationMin ? `${service.durationMin} minutes` : '—' },
              { label: 'Format', value: service?.type === 'IN_PERSON' ? 'In-Person' : service?.type === 'VIRTUAL' ? 'Online (Zoom)' : 'Online or In-Person' },
              { label: 'Date', value: start ? start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
              { label: 'Time', value: start ? `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}${end ? ` – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}` : '—' },
              { label: 'Price', value: formatPrice(booking.totalAmount), highlight: true },
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
              }}>
                <span style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>{row.label}</span>
                <span style={{ fontFamily: font, fontSize: '13px', fontWeight: row.highlight ? 600 : 400, color: row.highlight ? C.gold : C.charcoal }}>{row.value}</span>
              </div>
            ))}
          </Panel>

          {/* Client Notes */}
          {booking.notes && (
            <Panel title="Client Notes" icon="📝">
              <p style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {booking.notes}
              </p>
            </Panel>
          )}

          {/* Payment */}
          <Panel title="Payment" icon="💳">
            {payment ? (
              [
                { label: 'Status', value: payment.status === 'SUCCEEDED' ? 'Paid' : payment.status, color: payment.status === 'SUCCEEDED' ? '#2E7D32' : '#E65100' },
                { label: 'Amount', value: `$${Number(payment.amount).toFixed(2)}` },
                { label: 'Method', value: payment.paymentMethod || 'Card' },
                { label: 'Date', value: new Date(payment.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                }}>
                  <span style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>{row.label}</span>
                  <span style={{ fontFamily: font, fontSize: '12px', fontWeight: 500, color: row.color || C.charcoal }}>{row.value}</span>
                </div>
              ))
            ) : (
              <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>No payment recorded.</p>
            )}
          </Panel>

          {/* Cancellation */}
          {booking.status === 'CANCELLED' && (
            <Panel title="Cancellation" icon="❌">
              {[
                { label: 'Cancelled', value: booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
                { label: 'Reason', value: booking.cancellationReason || 'No reason provided' },
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                }}>
                  <span style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>{row.label}</span>
                  <span style={{ fontFamily: font, fontSize: '12px', color: C.charcoal }}>{row.value}</span>
                </div>
              ))}
            </Panel>
          )}
        </div>

        {/* Right — Actions */}
        <div>
          {(isPending || isConfirmed) && (
            <Panel title="Actions" icon="⚡">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {isPending && (
                  <Btn variant="green" onClick={() => updateStatus('confirm')}>
                    ✓ Confirm Booking
                  </Btn>
                )}
                {canComplete && (
                  <Btn variant="primary" onClick={() => updateStatus('complete')}>
                    ✓ Mark as Completed
                  </Btn>
                )}
                <Btn variant="danger" onClick={() => updateStatus('cancel')}>
                  Cancel Booking
                </Btn>
              </div>
            </Panel>
          )}

          {/* Booking timeline */}
          <Panel title="Timeline" icon="🕐">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Booked', date: booking.createdAt },
                ...(booking.status === 'CONFIRMED' ? [{ label: 'Confirmed', date: booking.updatedAt }] : []),
                ...(booking.status === 'COMPLETED' ? [{ label: 'Completed', date: booking.completedAt || booking.updatedAt }] : []),
                ...(booking.status === 'CANCELLED' ? [{ label: 'Cancelled', date: booking.cancelledAt }] : []),
              ].filter(t => t.date).map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.gold, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: font, fontSize: '12px', fontWeight: 500, color: C.charcoal }}>{t.label}</div>
                    <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>
                      {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
