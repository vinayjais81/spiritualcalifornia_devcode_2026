'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  C, font, serif, Btn, Panel, EmptyState, formatDate,
} from '@/components/guide/dashboard-ui';

interface Traveler {
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  email: string | null;
  phone: string | null;
}

interface ManifestRow {
  bookingId: string;
  bookingReference: string | null;
  status: string;
  travelers: number;
  roomType: string;
  departure: { startDate: string; endDate: string } | null;
  dietaryRequirements: string | null;
  dietaryNotes: string | null;
  healthConditions: string | null;
  contactEmail: string;
  contactPhone: string | null;
  manifest: Traveler[];
}

interface TourMeta {
  id: string;
  title: string;
  departures: { id: string; startDate: string; endDate: string; status: string }[];
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  PENDING: { bg: '#FFF8E1', color: '#F57F17', border: '1px solid #FFE082' },
  DEPOSIT_PAID: { bg: '#E1F5FE', color: '#0277BD', border: '1px solid #81D4FA' },
  FULLY_PAID: { bg: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7' },
  CONFIRMED: { bg: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7' },
  COMPLETED: { bg: '#F3E5F5', color: '#6A1B9A', border: '1px solid #CE93D8' },
  CANCELLED: { bg: '#FFEBEE', color: '#C62828', border: '1px solid #EF9A9A' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontFamily: font, fontSize: 11,
      background: s.bg, color: s.color, border: s.border, fontWeight: 500,
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function TourBookingsPage() {
  const params = useParams();
  const tourId = params?.id as string;
  const [tour, setTour] = useState<TourMeta | null>(null);
  const [departureFilter, setDepartureFilter] = useState<string>('all');
  const [rows, setRows] = useState<ManifestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tourId) return;
    // Load both: tour meta (for departures dropdown) and manifest
    Promise.all([
      api.get('/soul-tours/mine').then((r) => r.data.find((t: any) => t.id === tourId)),
      api.get(`/soul-tours/${tourId}/manifest`),
    ])
      .then(([tourData, manifestRes]) => {
        if (!tourData) {
          toast.error('Tour not found');
          return;
        }
        setTour({
          id: tourData.id,
          title: tourData.title,
          departures: tourData.departures || [],
        });
        setRows(manifestRes.data);
      })
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [tourId]);

  // Re-fetch manifest when filter changes
  useEffect(() => {
    if (!tourId || loading) return;
    const url = departureFilter === 'all'
      ? `/soul-tours/${tourId}/manifest`
      : `/soul-tours/${tourId}/manifest?departureId=${departureFilter}`;
    api.get(url)
      .then((r) => setRows(r.data))
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to filter'));
  }, [departureFilter]);


  // ─── CSV Export ────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const headers = [
      'Booking Ref', 'Status', 'Departure Start', 'Departure End', 'Room Type',
      'Traveler #', 'Primary?', 'First Name', 'Last Name', 'DOB', 'Nationality',
      'Email', 'Phone',
      'Dietary', 'Dietary Notes', 'Health Conditions',
    ];
    const lines: string[] = [headers.join(',')];
    for (const row of rows) {
      row.manifest.forEach((t, i) => {
        const cols = [
          row.bookingReference || row.bookingId,
          row.status,
          row.departure?.startDate ? formatDate(row.departure.startDate) : '',
          row.departure?.endDate ? formatDate(row.departure.endDate) : '',
          row.roomType,
          String(i + 1),
          t.isPrimary ? 'YES' : '',
          t.firstName,
          t.lastName,
          new Date(t.dateOfBirth).toISOString().slice(0, 10),
          t.nationality,
          t.email || row.contactEmail,
          t.phone || row.contactPhone || '',
          row.dietaryRequirements || '',
          row.dietaryNotes || '',
          row.healthConditions || '',
        ].map((c) => {
          const s = String(c ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? '"' + s.replace(/"/g, '""') + '"'
            : s;
        });
        lines.push(cols.join(','));
      });
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (tour?.title || 'tour').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `${safeName}-manifest-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Manifest exported');
  };

  const stats = useMemo(() => {
    const totalBookings = rows.length;
    const totalTravelers = rows.reduce((s, r) => s + r.travelers, 0);
    const dietaryCount = rows.filter((r) => r.dietaryRequirements && r.dietaryRequirements !== 'none').length;
    const healthCount = rows.filter((r) => r.healthConditions && r.healthConditions.trim()).length;
    return { totalBookings, totalTravelers, dietaryCount, healthCount };
  }, [rows]);

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, padding: 40 }}>Loading manifest…</div>;
  }

  return (
    <>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href={`/guide/dashboard/tours/${tourId}`}
          style={{ fontFamily: font, fontSize: 12, color: C.warmGray, textDecoration: 'none', letterSpacing: '0.06em' }}
        >
          ← Back to Tour
        </Link>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" size="sm" onClick={exportCsv}>📥 Export CSV</Btn>
        </div>
      </div>

      <h1 style={{ fontFamily: serif, fontSize: 36, fontWeight: 400, color: C.charcoal, marginBottom: 6 }}>
        Bookings & Manifest
      </h1>
      <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 32 }}>
        {tour?.title} — confirmed travelers with dietary needs and health flags
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.white, border: `1px solid rgba(232,184,75,0.15)`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 500, color: C.charcoal }}>{stats.totalBookings}</div>
          <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>Bookings</div>
        </div>
        <div style={{ background: C.goldPale, border: `1px solid ${C.gold}`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 500, color: C.gold }}>{stats.totalTravelers}</div>
          <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>Travelers</div>
        </div>
        <div style={{ background: C.white, border: `1px solid rgba(232,184,75,0.15)`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 500, color: C.charcoal }}>{stats.dietaryCount}</div>
          <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>Dietary Notes</div>
        </div>
        <div style={{ background: C.white, border: `1px solid rgba(232,184,75,0.15)`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 500, color: stats.healthCount > 0 ? C.red : C.charcoal }}>{stats.healthCount}</div>
          <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>Health Flags</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>
          Filter by departure:
        </span>
        <select
          value={departureFilter}
          onChange={(e) => setDepartureFilter(e.target.value)}
          style={{
            fontFamily: font, fontSize: 13, color: C.charcoal, background: C.offWhite,
            border: '1.5px solid rgba(232,184,75,0.3)', borderRadius: 8, padding: '8px 12px',
            outline: 'none',
          }}
        >
          <option value="all">All departures</option>
          {tour?.departures.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDate(d.startDate)} – {formatDate(d.endDate)}
            </option>
          ))}
        </select>
      </div>

      {/* Bookings list */}
      {rows.length === 0 ? (
        <Panel title="No bookings yet" icon="📋">
          <EmptyState message="When seekers book this tour, their details will appear here." />
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rows.map((row) => (
            <div key={row.bookingId} style={{
              background: C.white, border: '1px solid rgba(232,184,75,0.15)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Header strip */}
              <div style={{
                padding: '14px 20px', background: C.offWhite,
                borderBottom: '1px solid rgba(232,184,75,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 500, color: C.charcoal }}>
                    {row.bookingReference || row.bookingId.slice(0, 8)}
                  </span>
                  <StatusPill status={row.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, fontFamily: font, color: C.warmGray }}>
                  {row.departure && (
                    <span>📅 {formatDate(row.departure.startDate)} – {formatDate(row.departure.endDate)}</span>
                  )}
                  <span>🛏 {row.roomType}</span>
                  <span>👥 {row.travelers}</span>
                </div>
              </div>

              {/* Special needs strip */}
              {(row.dietaryRequirements || row.healthConditions) && (
                <div style={{
                  padding: '10px 20px', background: '#FFFAF0',
                  borderBottom: '1px solid rgba(232,184,75,0.1)',
                  display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: 12, fontFamily: font,
                }}>
                  {row.dietaryRequirements && row.dietaryRequirements !== 'none' && (
                    <span>🍽 <strong>{row.dietaryRequirements}</strong>{row.dietaryNotes ? ` — ${row.dietaryNotes}` : ''}</span>
                  )}
                  {row.healthConditions && (
                    <span style={{ color: C.red }}>⚕️ <strong>{row.healthConditions}</strong></span>
                  )}
                </div>
              )}

              {/* Travelers table */}
              <div style={{ padding: 20 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1.4fr 1fr 1fr 1.2fr 1fr',
                  gap: 12, padding: '0 0 8px',
                  fontFamily: font, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray,
                  borderBottom: '1px solid rgba(232,184,75,0.1)',
                }}>
                  <div>#</div>
                  <div>Name</div>
                  <div>DOB</div>
                  <div>Nationality</div>
                  <div>Email</div>
                  <div>Phone</div>
                </div>
                {row.manifest.map((t, i) => (
                    <div
                      key={`${row.bookingId}:${i}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1.4fr 1fr 1fr 1.2fr 1fr',
                        gap: 12, padding: '12px 0',
                        fontFamily: font, fontSize: 12, color: C.charcoal,
                        borderBottom: i < row.manifest.length - 1 ? '1px solid rgba(232,184,75,0.06)' : 'none',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{i + 1}</div>
                      <div>
                        {t.firstName} {t.lastName}
                        {t.isPrimary && (
                          <span style={{ marginLeft: 6, padding: '1px 6px', background: C.goldPale, color: C.gold, fontSize: 9, borderRadius: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Primary
                          </span>
                        )}
                      </div>
                      <div style={{ color: C.warmGray }}>
                        {new Date(t.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ color: C.warmGray }}>{t.nationality}</div>
                      <div style={{ color: C.warmGray }}>{t.email || '—'}</div>
                      <div style={{ color: C.warmGray }}>{t.phone || '—'}</div>
                    </div>
                ))}

                {/* Contact strip */}
                <div style={{
                  marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(232,184,75,0.1)',
                  display: 'flex', gap: 24, fontSize: 11, fontFamily: font, color: C.warmGray,
                }}>
                  <span>✉ {row.contactEmail || '—'}</span>
                  {row.contactPhone && <span>📞 {row.contactPhone}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
