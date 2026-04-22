'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  C, font, serif, Btn, Panel, Modal, FormGroup, TextArea, formatDate,
} from '@/components/guide/dashboard-ui';
import { useSiteConfigOrFallback } from '@/lib/siteConfig';

interface Traveler {
  id: string;
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  email: string | null;
  phone: string | null;
}

interface Payment {
  id: string;
  amount: string | number;
  status: string;
  paymentType: string;
  createdAt: string;
}

interface Booking {
  id: string;
  bookingReference: string | null;
  status: 'PENDING' | 'DEPOSIT_PAID' | 'FULLY_PAID' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  travelers: number;
  totalAmount: string | number;
  depositAmount: string | number | null;
  balanceAmount: string | number | null;
  balanceDueAt: string | null;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  currency: string;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  dietaryRequirements: string | null;
  dietaryNotes: string | null;
  healthConditions: string | null;
  intentions: string | null;
  contactEmail: string;
  contactPhone: string | null;
  tour: {
    title: string;
    slug: string;
    location: string | null;
    coverImageUrl: string | null;
    meetingPoint: string | null;
    currency: string;
  };
  roomType: { name: string; description: string | null };
  departure: { startDate: string; endDate: string } | null;
  travelers_rel: Traveler[];
  payments: Payment[];
}

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING: { bg: '#FFF8E1', color: '#F57F17', border: '1px solid #FFE082', label: 'Awaiting Payment' },
  DEPOSIT_PAID: { bg: '#E1F5FE', color: '#0277BD', border: '1px solid #81D4FA', label: 'Deposit Paid' },
  FULLY_PAID: { bg: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', label: 'Fully Paid' },
  CONFIRMED: { bg: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', label: 'Confirmed' },
  COMPLETED: { bg: '#F3E5F5', color: '#6A1B9A', border: '1px solid #CE93D8', label: 'Completed' },
  CANCELLED: { bg: '#FFEBEE', color: '#C62828', border: '1px solid #EF9A9A', label: 'Cancelled' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  return (
    <span style={{
      padding: '5px 14px', borderRadius: 20, fontFamily: font, fontSize: 12,
      background: s.bg, color: s.color, border: s.border, fontWeight: 500,
    }}>
      {s.label}
    </span>
  );
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export default function SeekerTourBookingDetailPage() {
  const params = useParams();
  const bookingId = params?.id as string;
  const siteConfig = useSiteConfigOrFallback();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    api.get(`/soul-tours/bookings/${bookingId}`)
      .then((r) => setBooking(r.data))
      .catch((err) => {
        if (err?.response?.status === 404 || err?.response?.status === 403) {
          setNotFound(true);
        } else {
          toast.error(err?.response?.data?.message || 'Failed to load booking');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (bookingId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ─── Compute refund estimate (matches backend logic) ─────────────────────
  const refundEstimate = (() => {
    if (!booking || !booking.departure) return null;
    const totalPaid = (booking.payments || [])
      .filter((p) => p.status === 'SUCCEEDED')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const daysUntil = daysBetween(new Date(), new Date(booking.departure.startDate));
    // Thresholds come from the platform tour default; the backend still owns
    // the per-tour override for the actual refund amount on cancel.
    const tourPolicy = siteConfig.cancellationPolicies.tourDefault;
    if (daysUntil >= tourPolicy.fullRefundDaysBefore) {
      return { amount: totalPaid, percent: 100, tier: 'FULL' };
    }
    if (daysUntil >= tourPolicy.halfRefundDaysBefore) {
      return { amount: totalPaid / 2, percent: 50, tier: 'HALF' };
    }
    return { amount: 0, percent: 0, tier: 'NONE' };
  })();

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      await api.post(`/soul-tours/bookings/${booking.id}/cancel`, {
        reason: cancelReason.trim() || undefined,
      });
      toast.success('Booking cancelled');
      setCancelOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, padding: 40 }}>Loading booking…</div>;
  }
  if (notFound || !booking) {
    return (
      <div style={{ padding: 40, fontFamily: font, fontSize: 14 }}>
        Booking not found.{' '}
        <Link href="/seeker/dashboard/tours" style={{ color: C.gold }}>← Back to My Tours</Link>
      </div>
    );
  }

  const balanceOwed = booking.status === 'DEPOSIT_PAID' && Number(booking.balanceAmount || 0) > 0;
  const canCancel = ['PENDING', 'DEPOSIT_PAID', 'FULLY_PAID', 'CONFIRMED'].includes(booking.status);
  const totalPaid = (booking.payments || [])
    .filter((p) => p.status === 'SUCCEEDED')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/seeker/dashboard/tours"
          style={{ fontFamily: font, fontSize: 12, color: C.warmGray, textDecoration: 'none', letterSpacing: '0.06em' }}
        >
          ← Back to My Tours
        </Link>
      </div>

      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24,
        background: C.white, border: '1px solid rgba(232,184,75,0.15)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 24,
      }}>
        <div
          style={{
            background: booking.tour.coverImageUrl
              ? `url(${booking.tour.coverImageUrl}) center/cover`
              : 'linear-gradient(135deg, #2C2420, #3A3530)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 48, color: 'rgba(255,255,255,0.4)', minHeight: 160,
          }}
        >
          {!booking.tour.coverImageUrl && '🏔️'}
        </div>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: serif, fontSize: 32, fontWeight: 400, color: C.charcoal }}>
              {booking.tour.title}
            </h1>
            <StatusPill status={booking.status} />
          </div>
          {booking.bookingReference && (
            <div style={{
              display: 'inline-block', fontFamily: 'monospace', fontSize: 12, color: C.warmGray,
              padding: '4px 10px', background: C.offWhite, borderRadius: 4,
              border: '1px solid rgba(232,184,75,0.15)', marginBottom: 12,
            }}>
              Reference: {booking.bookingReference}
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: C.charcoal, fontFamily: font, flexWrap: 'wrap', marginTop: 6 }}>
            {booking.departure && (
              <span>📅 {formatDate(booking.departure.startDate)} – {formatDate(booking.departure.endDate)}</span>
            )}
            {booking.tour.location && <span>📍 {booking.tour.location}</span>}
            <span>👥 {booking.travelers} traveler{booking.travelers > 1 ? 's' : ''}</span>
            <span>🛏 {booking.roomType.name}</span>
          </div>
        </div>
      </div>

      {/* Action banners */}
      {booking.status === 'CANCELLED' && (
        <div style={{
          padding: 20, background: '#FFEBEE', border: '1px solid #FFCDD2',
          borderRadius: 8, marginBottom: 24, fontFamily: font,
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#C62828', marginBottom: 4 }}>
            Booking cancelled{booking.cancelledAt ? ` on ${formatDate(booking.cancelledAt)}` : ''}
          </div>
          {booking.cancellationReason && (
            <div style={{ fontSize: 12, color: '#8A6960' }}>Reason: {booking.cancellationReason}</div>
          )}
        </div>
      )}

      {balanceOwed && (
        <div style={{
          padding: 20, background: '#FFF3E0', border: '1px solid #FFCC80',
          borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <div style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#E65100', marginBottom: 4 }}>
              ⚠️ Balance of ${Number(booking.balanceAmount).toLocaleString()} due
            </div>
            <div style={{ fontFamily: font, fontSize: 12, color: '#8A6960' }}>
              {booking.balanceDueAt
                ? `Pay before ${formatDate(booking.balanceDueAt)} to keep your spot.`
                : 'Pay to confirm your spot on this tour.'}
            </div>
          </div>
          <Link href={`/seeker/dashboard/tours/${booking.id}/pay-balance`} style={{ textDecoration: 'none' }}>
            <Btn variant="primary">Pay Balance Now</Btn>
          </Link>
        </div>
      )}

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* Left column */}
        <div>
          {/* Travelers */}
          <Panel title="Travelers" icon="👥">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {booking.travelers_rel.map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    background: C.offWhite, border: '1px solid rgba(232,184,75,0.12)',
                    borderRadius: 8, padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: C.gold, color: C.white, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontSize: 13, fontWeight: 600,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: C.charcoal }}>
                      {t.firstName} {t.lastName}
                    </span>
                    {t.isPrimary && (
                      <span style={{
                        padding: '2px 8px', background: C.goldPale, color: C.gold,
                        fontSize: 9, borderRadius: 4, letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        Primary
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
                    fontSize: 12, color: C.warmGray, fontFamily: font,
                  }}>
                    <div>🎂 DOB: {new Date(t.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    <div>🌍 {t.nationality}</div>
                    {t.email && <div>✉ {t.email}</div>}
                    {t.phone && <div>📞 {t.phone}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Health & preferences */}
          {(booking.dietaryRequirements || booking.healthConditions || booking.intentions) && (
            <Panel title="Health & Preferences" icon="🧘">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: font, fontSize: 13, color: C.charcoal }}>
                {booking.dietaryRequirements && (
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 4 }}>Dietary Requirements</div>
                    <div>🍽 {booking.dietaryRequirements}{booking.dietaryNotes ? ` — ${booking.dietaryNotes}` : ''}</div>
                  </div>
                )}
                {booking.healthConditions && (
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 4 }}>Health Conditions</div>
                    <div>⚕️ {booking.healthConditions}</div>
                  </div>
                )}
                {booking.intentions && (
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 4 }}>Your Intentions</div>
                    <div style={{ fontStyle: 'italic', color: C.warmGray, lineHeight: 1.6 }}>"{booking.intentions}"</div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Tour info */}
          <Panel title="Trip Information" icon="🗺️">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: font, fontSize: 13, color: C.charcoal }}>
              {booking.tour.meetingPoint && (
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 4 }}>Meeting Point</div>
                  <div>✈️ {booking.tour.meetingPoint}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 4 }}>Room</div>
                <div>🛏 {booking.roomType.name}{booking.roomType.description ? ` — ${booking.roomType.description}` : ''}</div>
              </div>
              <div>
                <Link href={`/tours/${booking.tour.slug}`} style={{ color: C.gold, textDecoration: 'none', fontSize: 12 }}>
                  View full tour details →
                </Link>
              </div>
            </div>
          </Panel>

          {/* Payment history */}
          <Panel title="Payment History" icon="💳">
            {booking.payments.length === 0 ? (
              <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray }}>No payments yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {booking.payments.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 120px 100px',
                      padding: '14px 0',
                      borderBottom: i < booking.payments.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                      fontFamily: font, fontSize: 13, alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ color: C.charcoal, fontWeight: 500 }}>
                        {p.paymentType === 'DEPOSIT' ? 'Deposit' : p.paymentType === 'BALANCE' ? 'Balance' : 'Full Payment'}
                      </div>
                      <div style={{ fontSize: 11, color: C.warmGray, marginTop: 2 }}>
                        {new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.warmGray }}>{p.id.slice(0, 8)}</div>
                    <div>
                      <span style={{
                        padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 500,
                        background: p.status === 'SUCCEEDED' ? '#E8F5E9' : p.status === 'FAILED' ? '#FFEBEE' : '#FFF8E1',
                        color: p.status === 'SUCCEEDED' ? '#2E7D32' : p.status === 'FAILED' ? '#C62828' : '#F57F17',
                        border: '1px solid',
                        borderColor: p.status === 'SUCCEEDED' ? '#A5D6A7' : p.status === 'FAILED' ? '#EF9A9A' : '#FFE082',
                      }}>
                        {p.status}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: serif, fontSize: 16, fontWeight: 500, color: C.charcoal }}>
                      ${Number(p.amount).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Right column — sidebar summary + actions */}
        <aside>
          <div style={{
            background: C.white, border: '1px solid rgba(232,184,75,0.2)',
            borderRadius: 12, padding: 24, position: 'sticky', top: 24,
          }}>
            <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: C.charcoal, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
              Booking Summary
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, fontFamily: font, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.warmGray }}>
                <span>Total</span>
                <span style={{ color: C.charcoal, fontWeight: 500 }}>${Number(booking.totalAmount).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.warmGray }}>
                <span>Paid so far</span>
                <span style={{ color: C.green, fontWeight: 500 }}>${totalPaid.toLocaleString()}</span>
              </div>
              {Number(booking.balanceAmount || 0) > 0 && booking.status !== 'CANCELLED' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.warmGray, paddingTop: 8, borderTop: '1px solid rgba(232,184,75,0.1)' }}>
                  <span>Balance due</span>
                  <span style={{ color: balanceOwed ? '#E65100' : C.charcoal, fontWeight: 500 }}>
                    ${Number(booking.balanceAmount).toLocaleString()}
                  </span>
                </div>
              )}
              {booking.balanceDueAt && booking.status === 'DEPOSIT_PAID' && (
                <div style={{ fontSize: 11, color: C.warmGray, textAlign: 'right', marginTop: 2 }}>
                  by {formatDate(booking.balanceDueAt)}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {balanceOwed && (
                <Link href={`/seeker/dashboard/tours/${booking.id}/pay-balance`} style={{ textDecoration: 'none' }}>
                  <Btn variant="primary" style={{ width: '100%', justifyContent: 'center' }}>
                    💳 Pay Balance
                  </Btn>
                </Link>
              )}
              <Link href={`/tours/${booking.tour.slug}`} style={{ textDecoration: 'none' }}>
                <Btn variant="secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  View Tour Details
                </Btn>
              </Link>
              {canCancel && (
                <Btn variant="danger" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setCancelOpen(true)}>
                  Cancel Booking
                </Btn>
              )}
            </div>

            <p style={{ fontFamily: font, fontSize: 10, color: C.warmGray, marginTop: 16, lineHeight: 1.5, textAlign: 'center' }}>
              Need help? Email{' '}
              <a href="mailto:support@spiritualcalifornia.com" style={{ color: C.gold }}>
                support@spiritualcalifornia.com
              </a>
            </p>
          </div>
        </aside>
      </div>

      {/* ── Cancel modal ────────────────────────────────────────────────── */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel This Booking?">
        <div style={{ fontFamily: font, fontSize: 13, color: C.charcoal, lineHeight: 1.7 }}>
          {refundEstimate && (
            <div style={{
              padding: 16, marginBottom: 20, borderRadius: 8,
              background: refundEstimate.tier === 'FULL'
                ? '#E8F5E9'
                : refundEstimate.tier === 'HALF'
                  ? '#FFF8E1'
                  : '#FFEBEE',
              border: `1px solid ${
                refundEstimate.tier === 'FULL' ? '#A5D6A7'
                : refundEstimate.tier === 'HALF' ? '#FFE082'
                : '#EF9A9A'
              }`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                {refundEstimate.tier === 'FULL' && '✓ Full refund eligible'}
                {refundEstimate.tier === 'HALF' && '⚠ 50% refund eligible'}
                {refundEstimate.tier === 'NONE' && '✗ No refund available'}
              </div>
              <div style={{ fontSize: 12, color: C.warmGray }}>
                Estimated refund: <strong style={{ color: C.charcoal }}>${refundEstimate.amount.toLocaleString()}</strong>
                {' '}({refundEstimate.percent}% of ${totalPaid.toLocaleString()} paid)
              </div>
              <div style={{ fontSize: 11, color: C.warmGray, marginTop: 6 }}>
                Refunds are processed by our team within 5–10 business days after cancellation.
              </div>
            </div>
          )}

          <p style={{ marginBottom: 16 }}>
            Cancelling will release your spot{booking.travelers > 1 ? 's' : ''} on this departure. Once cancelled, you cannot reverse this action — you would need to book again if a spot is still available.
          </p>

          <FormGroup label="Reason (optional)">
            <TextArea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Help us understand why you're cancelling…"
              style={{ minHeight: 80 }}
            />
          </FormGroup>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Btn variant="secondary" onClick={() => setCancelOpen(false)}>Keep Booking</Btn>
            <Btn
              variant="danger"
              onClick={handleCancel}
              style={cancelling ? { opacity: 0.6, pointerEvents: 'none' } : {}}
            >
              {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}
