'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, serif, formatPrice, PageHeader, Panel, Btn, EmptyState, ServiceTypeBadge } from '@/components/guide/dashboard-ui';

const statusStyles: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING: { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80', label: 'Pending' },
  CONFIRMED: { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7', label: 'Confirmed' },
  COMPLETED: { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9', label: 'Completed' },
  CANCELLED: { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A', label: 'Cancelled' },
  NO_SHOW: { bg: '#F5F5F5', color: '#757575', border: '#E0E0E0', label: 'No Show' },
};

export default function GuideBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  useEffect(() => {
    api.get('/bookings/guide-bookings')
      .then(r => setBookings(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Get unique services for filter dropdown
  const services = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    bookings.forEach(b => {
      const id = b.service?.id;
      if (!id) return;
      const existing = map.get(id);
      if (existing) { existing.count++; }
      else { map.set(id, { id, name: b.service.name, count: 1 }); }
    });
    return Array.from(map.values());
  }, [bookings]);

  const now = new Date();

  const filtered = bookings.filter(b => {
    // Service filter
    if (serviceFilter !== 'all' && b.service?.id !== serviceFilter) return false;
    // Status filter
    if (filter === 'all') return true;
    const start = b.slot?.startTime ? new Date(b.slot.startTime) : null;
    if (filter === 'upcoming') return start && start > now && ['PENDING', 'CONFIRMED'].includes(b.status);
    if (filter === 'cancelled') return b.status === 'CANCELLED';
    return (start && start <= now) || b.status === 'COMPLETED';
  });

  const confirmBooking = async (id: string) => {
    try {
      await api.patch(`/bookings/${id}/confirm`);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'CONFIRMED' } : b));
      toast.success('Booking confirmed');
    } catch { toast.error('Failed to confirm'); }
  };

  const completeBooking = async (id: string) => {
    try {
      await api.patch(`/bookings/${id}/complete`);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'COMPLETED' } : b));
      toast.success('Marked as completed');
    } catch { toast.error('Failed to complete'); }
  };

  const cancelBooking = async (id: string) => {
    if (!confirm('Cancel this booking? The seeker will be refunded per the cancellation policy.')) return;
    try {
      await api.patch(`/bookings/${id}/cancel`, { reason: 'Cancelled by guide' });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b));
      toast.success('Booking cancelled');
    } catch { toast.error('Failed to cancel'); }
  };

  if (loading) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;

  // Stats
  const totalBookings = bookings.length;
  const upcomingCount = bookings.filter(b => ['PENDING', 'CONFIRMED'].includes(b.status) && b.slot?.startTime && new Date(b.slot.startTime) > now).length;
  const revenue = bookings.filter(b => b.payment?.status === 'SUCCEEDED').reduce((s: number, b: any) => s + Number(b.payment.amount), 0);

  return (
    <div>
      <PageHeader title="Client Bookings" subtitle={`${totalBookings} total bookings · ${upcomingCount} upcoming · $${revenue.toFixed(0)} earned`} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'upcoming', 'past', 'cancelled'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '7px 16px', borderRadius: '20px', fontFamily: font, fontSize: '11px',
              fontWeight: filter === f ? 500 : 400, cursor: 'pointer',
              background: filter === f ? C.charcoal : 'transparent',
              color: filter === f ? C.gold : C.warmGray,
              border: filter === f ? 'none' : '1px solid rgba(232,184,75,0.3)',
              textTransform: 'capitalize',
            }}>
              {f}
            </button>
          ))}
        </div>
        {services.length > 1 && (
          <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} style={{
            fontFamily: font, fontSize: '12px', color: C.charcoal, background: C.offWhite,
            border: '1px solid rgba(232,184,75,0.3)', borderRadius: '6px', padding: '7px 12px', outline: 'none',
          }}>
            <option value="all">All Services</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.count})</option>
            ))}
          </select>
        )}
      </div>

      <Panel title={`Bookings (${filtered.length})`} icon="📋">
        {filtered.length === 0 ? (
          <EmptyState message="No bookings found for this filter." />
        ) : (
          <>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 120px 90px 130px',
              gap: '10px', padding: '0 0 10px', borderBottom: '1px solid rgba(232,184,75,0.15)',
            }}>
              {['Client', 'Service', 'Date & Time', 'Status', 'Actions'].map(h => (
                <div key={h} style={{ fontFamily: font, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.warmGray, fontWeight: 500 }}>{h}</div>
              ))}
            </div>

            {filtered.map((b: any) => {
              const seeker = b.seeker?.user;
              const start = b.slot?.startTime ? new Date(b.slot.startTime) : null;
              const s = statusStyles[b.status] || statusStyles.PENDING;
              const isPending = b.status === 'PENDING';
              const isConfirmed = b.status === 'CONFIRMED';
              const canComplete = isConfirmed && start && start <= now;

              return (
                <a key={b.id} href={`/guide/dashboard/bookings/${b.id}`} style={{
                  display: 'grid', gridTemplateColumns: '1fr 140px 120px 90px 130px',
                  gap: '10px', alignItems: 'center', padding: '14px 0',
                  borderBottom: '1px solid rgba(232,184,75,0.06)',
                  textDecoration: 'none', cursor: 'pointer',
                }}>
                  {/* Client */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {seeker?.avatarUrl ? (
                      <img src={seeker.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(232,184,75,0.3)' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.gold, border: '1.5px solid rgba(232,184,75,0.3)' }}>
                        {seeker?.firstName?.[0] || '?'}
                      </div>
                    )}
                    <div>
                      <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>
                        {seeker?.firstName} {seeker?.lastName}
                      </div>
                      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{seeker?.email}</div>
                    </div>
                  </div>

                  {/* Service */}
                  <div>
                    <div style={{ fontFamily: font, fontSize: '12px', fontWeight: 500, color: C.charcoal }}>{b.service?.name}</div>
                    <div style={{ fontFamily: font, fontSize: '10px', color: C.warmGray }}>{b.service?.durationMin} min · {formatPrice(b.service?.price)}</div>
                  </div>

                  {/* Date & Time */}
                  <div>
                    {start ? (
                      <>
                        <div style={{ fontFamily: font, fontSize: '12px', fontWeight: 500, color: C.charcoal }}>
                          {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>
                          {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                      </>
                    ) : <span style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>—</span>}
                  </div>

                  {/* Status */}
                  <span style={{
                    padding: '3px 8px', borderRadius: '20px', fontFamily: font, fontSize: '10px',
                    background: s.bg, color: s.color, border: `1px solid ${s.border}`, textAlign: 'center',
                  }}>{s.label}</span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.preventDefault()}>
                    {isPending && (
                      <button onClick={(e) => { e.stopPropagation(); confirmBooking(b.id); }} style={{
                        padding: '4px 10px', borderRadius: '4px', fontFamily: font, fontSize: '10px',
                        background: C.green, color: C.white, border: 'none', cursor: 'pointer',
                      }}>Confirm</button>
                    )}
                    {canComplete && (
                      <button onClick={(e) => { e.stopPropagation(); completeBooking(b.id); }} style={{
                        padding: '4px 10px', borderRadius: '4px', fontFamily: font, fontSize: '10px',
                        background: '#1565C0', color: C.white, border: 'none', cursor: 'pointer',
                      }}>Complete</button>
                    )}
                    {(isPending || isConfirmed) && (
                      <button onClick={(e) => { e.stopPropagation(); cancelBooking(b.id); }} style={{
                        padding: '4px 10px', borderRadius: '4px', fontFamily: font, fontSize: '10px',
                        background: 'transparent', color: C.red, border: `1px solid rgba(192,57,43,0.3)`, cursor: 'pointer',
                      }}>Cancel</button>
                    )}
                  </div>
                </a>
              );
            })}
          </>
        )}
      </Panel>

      {/* Per-service summary */}
      {services.length > 0 && (
        <Panel title="Bookings by Service" icon="📊">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
            {services.map(svc => {
              const svcBookings = bookings.filter(b => b.service?.id === svc.id);
              const upcoming = svcBookings.filter(b => ['PENDING', 'CONFIRMED'].includes(b.status)).length;
              const completed = svcBookings.filter(b => b.status === 'COMPLETED').length;
              const svcRevenue = svcBookings.filter(b => b.payment?.status === 'SUCCEEDED').reduce((s: number, b: any) => s + Number(b.payment.amount), 0);
              return (
                <div key={svc.id} style={{
                  background: C.offWhite, border: '1px solid rgba(232,184,75,0.12)',
                  borderRadius: '8px', padding: '16px',
                }}>
                  <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal, marginBottom: '8px' }}>{svc.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ fontFamily: serif, fontSize: '20px', fontWeight: 500, color: C.charcoal }}>{svc.count}</div>
                      <div style={{ fontFamily: font, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.warmGray }}>Total</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: serif, fontSize: '20px', fontWeight: 500, color: C.gold }}>{upcoming}</div>
                      <div style={{ fontFamily: font, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.warmGray }}>Upcoming</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: serif, fontSize: '20px', fontWeight: 500, color: C.green }}>${svcRevenue.toFixed(0)}</div>
                      <div style={{ fontFamily: font, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.warmGray }}>Revenue</div>
                    </div>
                  </div>
                  <button onClick={() => setServiceFilter(svc.id)} style={{
                    marginTop: '10px', fontFamily: font, fontSize: '11px', color: C.gold,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                    View bookings →
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
