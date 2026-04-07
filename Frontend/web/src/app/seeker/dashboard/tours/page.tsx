'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  C, font, serif, PageHeader, Panel, EmptyState, formatDate,
} from '@/components/guide/dashboard-ui';

interface TourBooking {
  id: string;
  bookingReference: string | null;
  status: 'PENDING' | 'DEPOSIT_PAID' | 'FULLY_PAID' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  travelers: number;
  totalAmount: string | number;
  depositAmount: string | number | null;
  balanceAmount: string | number | null;
  balanceDueAt: string | null;
  currency: string;
  createdAt: string;
  cancelledAt: string | null;
  tour: {
    title: string;
    slug: string;
    location: string | null;
    coverImageUrl: string | null;
  };
  roomType: { name: string };
  departure: { startDate: string; endDate: string } | null;
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
      padding: '4px 12px', borderRadius: 20, fontFamily: font, fontSize: 11,
      background: s.bg, color: s.color, border: s.border, fontWeight: 500,
    }}>
      {s.label}
    </span>
  );
}

export default function MyToursPage() {
  const [bookings, setBookings] = useState<TourBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    api.get('/soul-tours/my-bookings')
      .then((r) => setBookings(r.data || []))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to load tours'))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const departureStart = b.departure?.startDate ? new Date(b.departure.startDate) : null;
      if (filter === 'upcoming') {
        return departureStart && departureStart >= now
          && ['PENDING', 'DEPOSIT_PAID', 'FULLY_PAID', 'CONFIRMED'].includes(b.status);
      }
      if (filter === 'past') {
        return (departureStart && departureStart < now)
          || ['COMPLETED', 'CANCELLED'].includes(b.status);
      }
      return true;
    });
  }, [bookings, filter, now]);

  const stats = useMemo(() => {
    const upcoming = bookings.filter((b) => {
      const start = b.departure?.startDate ? new Date(b.departure.startDate) : null;
      return start && start >= now && !['CANCELLED'].includes(b.status);
    }).length;
    const balanceOwed = bookings
      .filter((b) => b.status === 'DEPOSIT_PAID' && b.balanceAmount)
      .reduce((sum, b) => sum + Number(b.balanceAmount || 0), 0);
    return { upcoming, balanceOwed };
  }, [bookings, now]);

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, padding: 40 }}>Loading your tours…</div>;
  }

  return (
    <>
      <PageHeader
        title="My Soul Tours"
        subtitle="Multi-day journeys you've booked. Manage, pay balance, or cancel here."
      >
        <Link href="/travels" style={{ textDecoration: 'none' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px',
            background: C.gold, color: C.white, borderRadius: 6,
            fontFamily: font, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
            🌍 Browse Tours
          </span>
        </Link>
      </PageHeader>

      {/* Stats row */}
      {bookings.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 36 }}>
          <div style={{ background: C.white, border: `1px solid rgba(232,184,75,0.15)`, borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 500, color: C.charcoal }}>{bookings.length}</div>
            <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>Total Bookings</div>
          </div>
          <div style={{ background: C.goldPale, border: `1px solid ${C.gold}`, borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 500, color: C.gold }}>{stats.upcoming}</div>
            <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>Upcoming Departures</div>
          </div>
          <div style={{
            background: stats.balanceOwed > 0 ? '#FFF3E0' : C.white,
            border: stats.balanceOwed > 0 ? '1px solid #FFCC80' : `1px solid rgba(232,184,75,0.15)`,
            borderRadius: 12, padding: 24, textAlign: 'center',
          }}>
            <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 500, color: stats.balanceOwed > 0 ? '#E65100' : C.charcoal }}>
              ${stats.balanceOwed.toLocaleString()}
            </div>
            <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>Balance Owed</div>
          </div>
        </div>
      )}

      {/* Filter pills */}
      {bookings.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['all', 'upcoming', 'past'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 20px', borderRadius: 20, fontFamily: font, fontSize: 12,
                fontWeight: filter === f ? 500 : 400, cursor: 'pointer',
                background: filter === f ? C.charcoal : 'transparent',
                color: filter === f ? C.gold : C.warmGray,
                border: filter === f ? 'none' : '1px solid rgba(232,184,75,0.3)',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {bookings.length === 0 ? (
        <div style={{
          background: C.white, border: '1px dashed rgba(232,184,75,0.35)',
          borderRadius: 12, padding: 60, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌍</div>
          <div style={{ fontFamily: serif, fontSize: 22, color: C.charcoal, marginBottom: 6 }}>
            No tours yet
          </div>
          <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 24 }}>
            Discover transformative multi-day journeys led by our verified guides.
          </p>
          <Link href="/travels" style={{
            display: 'inline-block', padding: '12px 28px', background: C.gold, color: C.white,
            textDecoration: 'none', borderRadius: 6, fontFamily: font, fontSize: 12,
            fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Browse Soul Tours
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <Panel title="No matching tours" icon="🔍">
          <EmptyState message={`You have no ${filter} tours.`} />
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {filtered.map((b) => {
            const departureStart = b.departure?.startDate;
            const departureEnd = b.departure?.endDate;
            const balanceDue = b.status === 'DEPOSIT_PAID' && Number(b.balanceAmount || 0) > 0;
            return (
              <Link
                key={b.id}
                href={`/seeker/dashboard/tours/${b.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  background: C.white, border: '1px solid rgba(232,184,75,0.15)',
                  borderRadius: 12, overflow: 'hidden',
                  display: 'grid', gridTemplateColumns: '180px 1fr auto',
                  cursor: 'pointer', transition: 'box-shadow 0.2s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(58,53,48,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Cover */}
                  <div
                    style={{
                      background: b.tour.coverImageUrl
                        ? `url(${b.tour.coverImageUrl}) center/cover`
                        : 'linear-gradient(135deg, #2C2420, #3A3530)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 48, color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {!b.tour.coverImageUrl && '🏔️'}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal }}>
                        {b.tour.title}
                      </h3>
                      <StatusPill status={b.status} />
                      {b.bookingReference && (
                        <span style={{
                          fontFamily: 'monospace', fontSize: 11, color: C.warmGray,
                          padding: '2px 8px', background: C.offWhite, borderRadius: 4,
                          border: '1px solid rgba(232,184,75,0.15)',
                        }}>
                          {b.bookingReference}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 24, fontSize: 12, color: C.charcoal, fontFamily: font, flexWrap: 'wrap', marginBottom: 10 }}>
                      {departureStart && departureEnd && (
                        <span>📅 {formatDate(departureStart)} – {formatDate(departureEnd)}</span>
                      )}
                      {b.tour.location && <span>📍 {b.tour.location}</span>}
                      <span>👥 {b.travelers} traveler{b.travelers > 1 ? 's' : ''}</span>
                      <span>🛏 {b.roomType.name}</span>
                    </div>
                    {balanceDue && (
                      <div style={{
                        marginTop: 8, padding: '8px 14px', background: '#FFF3E0',
                        border: '1px solid #FFCC80', borderRadius: 6, display: 'inline-flex',
                        alignItems: 'center', gap: 8, fontSize: 11, fontFamily: font, color: '#E65100',
                      }}>
                        ⚠️ Balance of <strong>${Number(b.balanceAmount).toLocaleString()}</strong> due{b.balanceDueAt ? ` by ${formatDate(b.balanceDueAt)}` : ''}
                      </div>
                    )}
                  </div>

                  {/* Right column */}
                  <div style={{
                    padding: 24, display: 'flex', flexDirection: 'column', gap: 8,
                    alignItems: 'flex-end', justifyContent: 'center',
                    borderLeft: '1px solid rgba(232,184,75,0.1)',
                    minWidth: 180,
                  }}>
                    <div style={{ fontSize: 10, color: C.warmGray, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 500, color: C.charcoal }}>
                      ${Number(b.totalAmount).toLocaleString()}
                    </div>
                    {b.depositAmount && Number(b.depositAmount) > 0 && (
                      <div style={{ fontSize: 11, color: C.warmGray }}>
                        Deposit: ${Number(b.depositAmount).toLocaleString()}
                      </div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 11, color: C.gold }}>
                      View details →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
