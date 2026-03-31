'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Tour {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  basePrice: number;
  capacity: number;
  spotsRemaining: number;
  coverImageUrl: string | null;
  shortDesc: string | null;
  highlights: string[];
  guide: { displayName: string; slug: string; user: { avatarUrl: string | null } };
  roomTypes: Array<{ name: string; totalPrice: number }>;
}

const fallbackTours: Tour[] = [
  { id: 't1', title: 'Nepal — Himalayan Awakening', slug: 'nepal-himalayan-awakening', startDate: '2026-05-09', endDate: '2026-05-18', location: 'Kathmandu, Pokhara, Lumbini', basePrice: 3800, capacity: 12, spotsRemaining: 5, coverImageUrl: null, shortDesc: 'A transformative 10-day journey through sacred sites, ancient monasteries, and meditation retreats in the Himalayan foothills.', highlights: ['Temple visits', 'Meditation retreat', 'Mountain trekking'], guide: { displayName: 'Luna Rivera', slug: 'luna-rivera', user: { avatarUrl: null } }, roomTypes: [{ name: 'Shared', totalPrice: 3800 }] },
  { id: 't2', title: 'Bali — Sacred Waters Journey', slug: 'bali-sacred-waters', startDate: '2026-06-14', endDate: '2026-06-22', location: 'Ubud, Tirta Empul, Uluwatu', basePrice: 2900, capacity: 16, spotsRemaining: 9, coverImageUrl: null, shortDesc: 'Immerse yourself in Balinese healing traditions — water purification ceremonies, rice terrace meditation, and temple offerings.', highlights: ['Water ceremonies', 'Rice terrace walks', 'Temple rituals'], guide: { displayName: 'Priya Sharma', slug: 'priya-sharma', user: { avatarUrl: null } }, roomTypes: [{ name: 'Shared', totalPrice: 2900 }] },
  { id: 't3', title: 'Sedona — Vortex & Vision Quest', slug: 'sedona-vortex-quest', startDate: '2026-07-05', endDate: '2026-07-10', location: 'Sedona, Arizona', basePrice: 1800, capacity: 10, spotsRemaining: 3, coverImageUrl: null, shortDesc: 'Five days exploring Sedona\'s legendary energy vortexes, with guided vision quests and sweat lodge ceremonies.', highlights: ['Vortex hikes', 'Vision quest', 'Sweat lodge'], guide: { displayName: 'James O\'Brien', slug: 'james-obrien', user: { avatarUrl: null } }, roomTypes: [{ name: 'Shared', totalPrice: 1800 }] },
];

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function daysBetween(a: string, b: string) { return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000); }

export default function TravelsPage() {
  const [tours, setTours] = useState<Tour[]>(fallbackTours);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/soul-tours');
        if (res.data?.tours?.length) setTours(res.data.tours);
      } catch { /* keep fallback */ }
      finally { setLoading(false); }
    };
    fetch();
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

      {/* Tour cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {tours.map(tour => {
          const days = daysBetween(tour.startDate, tour.endDate);
          return (
            <div key={tour.id} style={{
              background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 16,
              overflow: 'hidden', display: 'grid', gridTemplateColumns: '380px 1fr',
              transition: 'box-shadow 0.3s',
            }}>
              {/* Image */}
              <div style={{ background: 'linear-gradient(135deg, #2C2420, #3A3530)', minHeight: 280, position: 'relative', overflow: 'hidden' }}>
                {tour.coverImageUrl ? (
                  <img src={tour.coverImageUrl} alt={tour.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>🏔️</div>
                )}
                {tour.spotsRemaining <= 5 && (
                  <span style={{
                    position: 'absolute', top: 16, right: 16, padding: '5px 12px', borderRadius: 20,
                    background: '#C0392B', color: '#fff', fontSize: 10, fontWeight: 600,
                  }}>
                    {tour.spotsRemaining} spots left
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8B84B', fontWeight: 600 }}>
                    {fmtDate(tour.startDate)} – {fmtDate(tour.endDate)}, {new Date(tour.startDate).getFullYear()}
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(232,184,75,0.1)', color: '#B8960F', fontSize: 10, fontWeight: 600 }}>
                    {days} days
                  </span>
                </div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', lineHeight: 1.2, marginBottom: 10 }}>
                  {tour.title}
                </h2>
                {tour.shortDesc && (
                  <p style={{ fontSize: 14, color: '#8A8278', lineHeight: 1.65, marginBottom: 16 }}>{tour.shortDesc}</p>
                )}
                {tour.location && <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 12 }}>📍 {tour.location}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {tour.highlights.slice(0, 4).map(h => (
                    <span key={h} style={{ padding: '4px 12px', borderRadius: 20, background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)', fontSize: 11, color: '#3A3530' }}>
                      {h}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FDF6E3', border: '2px solid #E8B84B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#E8B84B' }}>
                      {tour.guide.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530' }}>{tour.guide.displayName}</div>
                      <div style={{ fontSize: 11, color: '#8A8278' }}>Trip Leader</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#3A3530' }}>
                      ${tour.basePrice.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: '#8A8278' }}>per person</div>
                  </div>
                </div>
                <Link href={`/tours/${tour.slug}/book`} style={{
                  display: 'block', width: '100%', padding: 14, borderRadius: 8, marginTop: 20,
                  background: '#E8B84B', color: '#3A3530', textAlign: 'center',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  textDecoration: 'none',
                }}>
                  Book This Journey
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
