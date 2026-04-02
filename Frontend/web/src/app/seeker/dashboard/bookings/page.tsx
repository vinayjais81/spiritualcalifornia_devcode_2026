'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, PageHeader, Panel, EmptyState } from '@/components/guide/dashboard-ui';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

const statusStyles: Record<BookingStatus, { bg: string; color: string; border: string; label: string }> = {
  PENDING: { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80', label: 'Pending' },
  CONFIRMED: { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7', label: 'Confirmed' },
  COMPLETED: { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9', label: 'Completed' },
  CANCELLED: { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A', label: 'Cancelled' },
  NO_SHOW: { bg: '#F5F5F5', color: '#757575', border: '#E0E0E0', label: 'No Show' },
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    api.get('/bookings/my-bookings')
      .then(r => setBookings(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cancelBooking = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.patch(`/bookings/${id}/cancel`, { reason: 'Cancelled by seeker' });
      toast.success('Booking cancelled');
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b));
    } catch {
      toast.error('Failed to cancel booking');
    }
  };

  const now = new Date();
  const filtered = bookings.filter(b => {
    if (filter === 'all') return true;
    const start = b.slot?.startTime ? new Date(b.slot.startTime) : null;
    if (filter === 'upcoming') return start && start > now && ['PENDING', 'CONFIRMED'].includes(b.status);
    return (start && start <= now) || ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(b.status);
  });

  if (loading) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <PageHeader title="My Bookings" subtitle="View and manage your session bookings." />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['all', 'upcoming', 'past'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 20px', borderRadius: '20px', fontFamily: font, fontSize: '12px',
            fontWeight: filter === f ? 500 : 400, cursor: 'pointer', transition: 'all 0.2s',
            background: filter === f ? C.charcoal : 'transparent',
            color: filter === f ? C.gold : C.warmGray,
            border: filter === f ? 'none' : '1px solid rgba(232,184,75,0.3)',
            textTransform: 'capitalize',
          }}>
            {f} {f === 'all' ? `(${bookings.length})` : ''}
          </button>
        ))}
      </div>

      <Panel title="Sessions" icon="📋">
        {filtered.length === 0 ? (
          <EmptyState message={filter === 'upcoming' ? 'No upcoming sessions.' : filter === 'past' ? 'No past sessions yet.' : 'No bookings yet. Browse practitioners to book your first session.'} />
        ) : (
          filtered.map((b: any) => {
            const start = b.slot?.startTime ? new Date(b.slot.startTime) : null;
            const s = statusStyles[b.status as BookingStatus] || statusStyles.PENDING;
            const canCancel = ['PENDING', 'CONFIRMED'].includes(b.status) && start && start > now;
            return (
              <a key={b.id} href={`/seeker/dashboard/bookings/${b.id}`} style={{
                display: 'grid', gridTemplateColumns: '1fr 160px 100px 80px',
                gap: '12px', alignItems: 'center', padding: '16px 0',
                borderBottom: '1px solid rgba(232,184,75,0.08)',
                textDecoration: 'none', cursor: 'pointer',
              }}>
                <div>
                  <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{b.service?.name}</div>
                  <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, marginTop: '2px' }}>with {b.service?.guide?.displayName}</div>
                  <span style={{ fontFamily: font, fontSize: '11px', color: C.gold }}>View details →</span>
                </div>
                <div>
                  {start ? (
                    <>
                      <div style={{ fontFamily: font, fontSize: '12px', fontWeight: 500, color: C.charcoal }}>
                        {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>
                        {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                    </>
                  ) : <span style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>—</span>}
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontFamily: font, fontSize: '11px',
                  background: s.bg, color: s.color, border: `1px solid ${s.border}`, textAlign: 'center',
                }}>{s.label}</span>
                <div>{canCancel && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); cancelBooking(b.id); }} style={{ padding: '5px 12px', borderRadius: '4px', fontFamily: font, fontSize: '11px', background: 'transparent', color: C.red, border: `1px solid rgba(192,57,43,0.3)`, cursor: 'pointer' }}>Cancel</button>}</div>
              </a>
            );
          })
        )}
      </Panel>
    </div>
  );
}
