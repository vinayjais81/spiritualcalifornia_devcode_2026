'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Departure {
  id: string;
  startDate: string;
  endDate: string;
  capacity: number;
  spotsRemaining: number;
  status: string;
}

interface Tour {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  basePrice: number | string;
  capacity: number;
  spotsRemaining: number;
  coverImageUrl: string | null;
  shortDesc: string | null;
  highlights: string[];
  difficultyLevel: string | null;
  guide: { displayName: string; slug: string; user: { avatarUrl: string | null } };
  roomTypes: Array<{ name: string; totalPrice: number | string }>;
  departures: Departure[];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export default function TravelsPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/soul-tours')
      .then((res) => setTours(res.data?.tours || []))
      .catch(() => setTours([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px 80px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 10 }}>✦ Soul Travels</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          Journeys That Transform
        </h1>
        <p style={{ fontSize: 15, color: '#8A8278', maxWidth: 560, margin: '0 auto' }}>
          Multi-day retreats and sacred journeys led by verified practitioners — from Himalayan monasteries to Balinese temples.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#8A8278', fontSize: 14 }}>
          Loading journeys…
        </div>
      )}

      {/* Empty */}
      {!loading && tours.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 80,
          background: '#fff', border: '1px dashed rgba(232,184,75,0.3)', borderRadius: 16,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏔️</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#3A3530', marginBottom: 8 }}>
            New journeys coming soon
          </h2>
          <p style={{ color: '#8A8278', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
            Our verified guides are crafting transformative tours. Check back soon, or sign up to be notified when new journeys are published.
          </p>
        </div>
      )}

      {/* Tour cards */}
      {!loading && tours.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {tours.map((tour) => {
            // Find the next upcoming departure (already filtered by backend, but defensive)
            const upcomingDepartures = (tour.departures || []).filter(
              (d) => d.status === 'SCHEDULED' && new Date(d.startDate) >= new Date(),
            );
            const nextDeparture = upcomingDepartures
              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

            const departureStart = nextDeparture?.startDate || tour.startDate;
            const departureEnd = nextDeparture?.endDate || tour.endDate;
            const days = daysBetween(departureStart, departureEnd);
            const spotsLeft = nextDeparture?.spotsRemaining ?? tour.spotsRemaining;
            const totalDeparturesCount = upcomingDepartures.length;

            return (
              <Link
                key={tour.id}
                href={`/tours/${tour.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 16,
                  overflow: 'hidden', display: 'grid', gridTemplateColumns: '380px 1fr',
                  transition: 'box-shadow 0.3s, transform 0.3s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 12px 40px rgba(58,53,48,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Image */}
                  <div style={{ background: 'linear-gradient(135deg, #2C2420, #3A3530)', minHeight: 280, position: 'relative', overflow: 'hidden' }}>
                    {tour.coverImageUrl ? (
                      <img src={tour.coverImageUrl} alt={tour.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>🏔️</div>
                    )}
                    {spotsLeft <= 5 && spotsLeft > 0 && (
                      <span style={{
                        position: 'absolute', top: 16, right: 16, padding: '5px 12px', borderRadius: 20,
                        background: '#C0392B', color: '#fff', fontSize: 10, fontWeight: 600,
                      }}>
                        {spotsLeft} spots left
                      </span>
                    )}
                    {totalDeparturesCount > 1 && (
                      <span style={{
                        position: 'absolute', top: 16, left: 16, padding: '5px 12px', borderRadius: 20,
                        background: 'rgba(255,255,255,0.95)', color: '#3A3530',
                        fontSize: 10, fontWeight: 600,
                      }}>
                        {totalDeparturesCount} departures
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                      {nextDeparture ? (
                        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8B84B', fontWeight: 600 }}>
                          NEXT: {fmtDate(departureStart)} – {fmtDate(departureEnd)}, {new Date(departureStart).getFullYear()}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C0392B', fontWeight: 600 }}>
                          Dates coming soon
                        </span>
                      )}
                      <span style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(232,184,75,0.1)', color: '#B8960F', fontSize: 10, fontWeight: 600 }}>
                        {days} days
                      </span>
                      {tour.difficultyLevel && (
                        <span style={{ padding: '3px 10px', borderRadius: 12, background: '#FAFAF7', color: '#8A8278', fontSize: 10, fontWeight: 600, border: '1px solid rgba(232,184,75,0.15)' }}>
                          {tour.difficultyLevel}
                        </span>
                      )}
                    </div>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', lineHeight: 1.2, marginBottom: 10 }}>
                      {tour.title}
                    </h2>
                    {tour.shortDesc && (
                      <p style={{ fontSize: 14, color: '#8A8278', lineHeight: 1.65, marginBottom: 16 }}>{tour.shortDesc}</p>
                    )}
                    {tour.location && <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 12 }}>📍 {tour.location}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                      {tour.highlights.slice(0, 4).map((h) => (
                        <span key={h} style={{ padding: '4px 12px', borderRadius: 20, background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)', fontSize: 11, color: '#3A3530' }}>
                          {h}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: '#FDF6E3', border: '2px solid #E8B84B',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600, color: '#E8B84B', overflow: 'hidden',
                        }}>
                          {tour.guide.user.avatarUrl ? (
                            <img src={tour.guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            tour.guide.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530' }}>{tour.guide.displayName}</div>
                          <div style={{ fontSize: 11, color: '#8A8278' }}>Trip Leader</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#8A8278', letterSpacing: '0.06em', textTransform: 'uppercase' }}>From</div>
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#3A3530' }}>
                          ${Number(tour.basePrice).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: '#8A8278' }}>per person</div>
                      </div>
                    </div>
                    <div style={{
                      display: 'block', width: '100%', padding: 14, borderRadius: 8, marginTop: 20,
                      background: '#E8B84B', color: '#3A3530', textAlign: 'center',
                      fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      View Journey →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
