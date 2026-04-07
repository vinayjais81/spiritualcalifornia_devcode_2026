'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  C, font, serif, PageHeader, Btn, StatCard, EmptyState, StatusBadge, formatDate,
} from '@/components/guide/dashboard-ui';

interface TourDeparture {
  id: string;
  startDate: string;
  endDate: string;
  capacity: number;
  spotsRemaining: number;
  status: 'SCHEDULED' | 'FULL' | 'CANCELLED' | 'COMPLETED';
}

interface Tour {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  basePrice: string | number;
  currency: string;
  capacity: number;
  spotsRemaining: number;
  coverImageUrl: string | null;
  isPublished: boolean;
  isCancelled: boolean;
  startDate: string;
  endDate: string;
  departures: TourDeparture[];
  _count: { bookings: number };
}

export default function GuideToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/soul-tours/mine')
      .then((r) => setTours(r.data))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to load tours'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone — all departures and bookings on this tour will be removed.`)) return;
    try {
      await api.delete(`/soul-tours/${id}`);
      setTours((t) => t.filter((x) => x.id !== id));
      toast.success('Tour deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete tour');
    }
  };

  const togglePublish = async (tour: Tour) => {
    try {
      await api.put(`/soul-tours/${tour.id}`, { isPublished: !tour.isPublished });
      setTours((t) => t.map((x) => (x.id === tour.id ? { ...x, isPublished: !tour.isPublished } : x)));
      toast.success(tour.isPublished ? 'Tour unpublished' : 'Tour published');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update');
    }
  };

  // ─── Computed stats ────────────────────────────────────────────────────────
  const totalTours = tours.length;
  const publishedCount = tours.filter((t) => t.isPublished && !t.isCancelled).length;
  const totalBookings = tours.reduce((sum, t) => sum + (t._count?.bookings || 0), 0);
  const upcomingDepartures = tours.reduce((sum, t) => {
    const now = new Date();
    return sum + t.departures.filter((d) => d.status === 'SCHEDULED' && new Date(d.startDate) >= now).length;
  }, 0);

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, padding: 40 }}>Loading tours...</div>;
  }

  return (
    <>
      <PageHeader
        title="Soul Tours"
        subtitle="Create and manage multi-day spiritual journeys for your seekers"
      >
        <Link href="/guide/dashboard/tours/new" style={{ textDecoration: 'none' }}>
          <Btn variant="primary">+ New Tour</Btn>
        </Link>
      </PageHeader>

      {/* ─── Stats row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 36 }}>
        <StatCard value={totalTours} label="Total Tours" />
        <StatCard value={publishedCount} label="Published" accent />
        <StatCard value={upcomingDepartures} label="Upcoming Departures" />
        <StatCard value={totalBookings} label="Total Bookings" />
      </div>

      {/* ─── List ─────────────────────────────────────────────────────────── */}
      {tours.length === 0 ? (
        <div style={{
          background: C.white, border: '1px dashed rgba(232,184,75,0.35)',
          borderRadius: 12, padding: 60, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌍</div>
          <div style={{ fontFamily: serif, fontSize: 22, color: C.charcoal, marginBottom: 6 }}>
            No tours yet
          </div>
          <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 24 }}>
            Create your first multi-day spiritual journey. You can add multiple departure dates,
            day-by-day itinerary, room types, and inclusions.
          </p>
          <Link href="/guide/dashboard/tours/new" style={{ textDecoration: 'none' }}>
            <Btn variant="primary">Create Your First Tour</Btn>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {tours.map((t) => {
            const nextDeparture = t.departures
              .filter((d) => d.status === 'SCHEDULED' && new Date(d.startDate) >= new Date())
              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

            return (
              <div
                key={t.id}
                style={{
                  background: C.white, border: '1px solid rgba(232,184,75,0.15)',
                  borderRadius: 12, overflow: 'hidden',
                  display: 'grid', gridTemplateColumns: '180px 1fr auto',
                }}
              >
                {/* Cover image */}
                <div
                  style={{
                    background: t.coverImageUrl
                      ? `url(${t.coverImageUrl}) center/cover`
                      : 'linear-gradient(135deg, #2C2420, #3A3530)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 48, color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {!t.coverImageUrl && '🏔️'}
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal }}>
                      {t.title}
                    </h3>
                    <StatusBadge published={t.isPublished && !t.isCancelled} />
                    {t.isCancelled && (
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontFamily: font, fontSize: 11, background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2' }}>
                        Cancelled
                      </span>
                    )}
                  </div>
                  {t.shortDesc && (
                    <p style={{ fontFamily: font, fontSize: 12, color: C.warmGray, marginBottom: 12, lineHeight: 1.5 }}>
                      {t.shortDesc}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 24, fontSize: 12, color: C.charcoal, fontFamily: font }}>
                    <span>📍 {t.location || [t.city, t.country].filter(Boolean).join(', ') || '—'}</span>
                    <span>💰 From ${Number(t.basePrice).toLocaleString()}</span>
                    <span>👥 {t.capacity} max</span>
                    <span>📋 {t._count?.bookings || 0} bookings</span>
                  </div>
                  {nextDeparture && (
                    <div style={{
                      marginTop: 12, padding: '6px 12px',
                      background: C.goldPale, border: '1px solid rgba(232,184,75,0.3)',
                      borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8,
                      fontSize: 11, fontFamily: font, color: C.charcoal,
                    }}>
                      <span style={{ color: C.gold }}>▸</span>
                      Next departure: <strong>{formatDate(nextDeparture.startDate)} – {formatDate(nextDeparture.endDate)}</strong>
                      <span style={{ color: nextDeparture.spotsRemaining <= 2 ? C.red : C.warmGray }}>
                        ({nextDeparture.spotsRemaining}/{nextDeparture.capacity} spots left)
                      </span>
                    </div>
                  )}
                  {!nextDeparture && (
                    <div style={{
                      marginTop: 12, fontSize: 11, fontFamily: font, color: C.red,
                    }}>
                      ⚠️ No upcoming departures — add one to make this tour bookable
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{
                  padding: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
                  borderLeft: '1px solid rgba(232,184,75,0.1)',
                }}>
                  <Link href={`/guide/dashboard/tours/${t.id}`} style={{ textDecoration: 'none' }}>
                    <Btn variant="secondary" size="sm">✎ Edit</Btn>
                  </Link>
                  <Link href={`/guide/dashboard/tours/${t.id}/bookings`} style={{ textDecoration: 'none' }}>
                    <Btn variant="secondary" size="sm">📋 Bookings ({t._count?.bookings || 0})</Btn>
                  </Link>
                  <Btn variant={t.isPublished ? 'secondary' : 'green'} size="sm" onClick={() => togglePublish(t)}>
                    {t.isPublished ? '⏸ Unpublish' : '▶ Publish'}
                  </Btn>
                  <Btn variant="danger" size="sm" onClick={() => remove(t.id, t.title)}>🗑 Delete</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
