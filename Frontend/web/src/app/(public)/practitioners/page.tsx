'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Guide {
  id: string;
  slug: string;
  displayName: string;
  tagline: string | null;
  location: string | null;
  averageRating: number;
  totalReviews: number;
  isVerified: boolean;
  modalities: string[];
  categories: Array<{ category: { name: string } }>;
  user: { avatarUrl: string | null };
  services: Array<{ price: number; type: string; durationMin: number }>;
}

const fallbackGuides: Guide[] = [
  { id: 'g1', slug: 'luna-rivera', displayName: 'Luna Rivera', tagline: 'Sound Healer & Crystal Practitioner', location: 'Los Gatos, CA', averageRating: 4.9, totalReviews: 38, isVerified: true, modalities: ['Sound Healing', 'Crystal Therapy'], categories: [{ category: { name: 'Sound Healing' } }], user: { avatarUrl: null }, services: [{ price: 85, type: 'HYBRID', durationMin: 60 }] },
  { id: 'g2', slug: 'dr-sarah-chen', displayName: 'Dr. Sarah Chen, L.Ac.', tagline: 'Acupuncturist & TCM Practitioner', location: 'San Jose, CA', averageRating: 4.8, totalReviews: 52, isVerified: true, modalities: ['Acupuncture', 'TCM'], categories: [{ category: { name: 'Traditional Medicine' } }], user: { avatarUrl: null }, services: [{ price: 120, type: 'IN_PERSON', durationMin: 60 }] },
  { id: 'g3', slug: 'marcus-thompson', displayName: 'Marcus Thompson, PCC', tagline: 'Life Coach & Breathwork Facilitator', location: 'Campbell, CA', averageRating: 4.7, totalReviews: 29, isVerified: true, modalities: ['Breathwork', 'Life Coaching'], categories: [{ category: { name: 'Coaching' } }], user: { avatarUrl: null }, services: [{ price: 95, type: 'VIRTUAL', durationMin: 60 }] },
  { id: 'g4', slug: 'priya-sharma', displayName: 'Priya Sharma, E-RYT 500', tagline: 'Yoga Teacher & Meditation Guide', location: 'Cupertino, CA', averageRating: 5.0, totalReviews: 44, isVerified: true, modalities: ['Yoga', 'Meditation'], categories: [{ category: { name: 'Yoga' } }], user: { avatarUrl: null }, services: [{ price: 75, type: 'HYBRID', durationMin: 60 }] },
  { id: 'g5', slug: 'maya-williams', displayName: 'Maya Williams, Reiki Master', tagline: 'Reiki & Sound Healing', location: 'Los Altos, CA', averageRating: 4.9, totalReviews: 33, isVerified: true, modalities: ['Reiki', 'Sound Healing'], categories: [{ category: { name: 'Energy Work' } }], user: { avatarUrl: null }, services: [{ price: 90, type: 'HYBRID', durationMin: 60 }] },
  { id: 'g6', slug: 'carlos-mendez', displayName: 'Carlos Mendez, QiGong Sifu', tagline: 'Qi Gong & Tai Chi Teacher', location: 'San Jose, CA', averageRating: 4.8, totalReviews: 21, isVerified: true, modalities: ['Qi Gong', 'Tai Chi'], categories: [{ category: { name: 'Movement' } }], user: { avatarUrl: null }, services: [{ price: 65, type: 'IN_PERSON', durationMin: 60 }] },
];

const categoryFilters = ['All', 'Sound Healing', 'Energy Work', 'Yoga', 'Coaching', 'Traditional Medicine', 'Meditation', 'Movement'];
const typeFilters = ['All Types', 'Online', 'In-Person', 'Hybrid'];

const typeBadge = (type: string) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    VIRTUAL: { label: 'Online', bg: 'rgba(90,138,106,0.12)', color: '#5A8A6A' },
    IN_PERSON: { label: 'In-Person', bg: 'rgba(240,120,32,0.1)', color: '#F07820' },
    HYBRID: { label: 'Online & In-Person', bg: 'rgba(232,184,75,0.1)', color: '#B8960F' },
  };
  return map[type] || map.HYBRID;
};

export default function PractitionersPage() {
  const [guides, setGuides] = useState<Guide[]>(fallbackGuides);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeType, setActiveType] = useState('All Types');
  const [sortBy, setSortBy] = useState('rating');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        if (searchQuery) {
          const res = await api.get('/search/guides', { params: { q: searchQuery } });
          if (res.data?.hits?.length) {
            setGuides(res.data.hits.map((h: any) => ({
              ...h, id: h.objectID, categories: (h.categories || []).map((c: string) => ({ category: { name: c } })),
              user: { avatarUrl: h.avatarUrl }, services: h.sessionPrice60 ? [{ price: h.sessionPrice60, type: 'HYBRID', durationMin: 60 }] : [],
            })));
            return;
          }
        }
        // Fallback: fetch from guides API
        const res = await api.get('/home');
        if (res.data?.featuredGuides?.length) setGuides(res.data.featuredGuides);
      } catch { /* keep fallback */ }
      finally { setLoading(false); }
    };
    const debounce = setTimeout(fetch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Client-side filtering
  const filtered = guides.filter(g => {
    if (activeCategory !== 'All' && !(g.categories ?? []).some(c => c.category?.name === activeCategory) && !(g.modalities ?? []).includes(activeCategory)) return false;
    if (activeType === 'Online' && !(g.services ?? []).some(s => s.type === 'VIRTUAL' || s.type === 'HYBRID')) return false;
    if (activeType === 'In-Person' && !(g.services ?? []).some(s => s.type === 'IN_PERSON' || s.type === 'HYBRID')) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'rating') return b.averageRating - a.averageRating;
    if (sortBy === 'reviews') return b.totalReviews - a.totalReviews;
    if (sortBy === 'price-low') return (a.services?.[0]?.price ?? 999) - (b.services?.[0]?.price ?? 999);
    return 0;
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px 80px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 10 }}>✦ Find Your Guide</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          Verified Practitioners
        </h1>
        <p style={{ fontSize: 15, color: '#8A8278', maxWidth: 520, margin: '0 auto 24px' }}>
          Every practitioner is identity-verified and credential-checked. Find the right guide for your journey.
        </p>
        {/* Search */}
        <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, specialty, modality..."
            style={{
              width: '100%', padding: '16px 20px 16px 44px', borderRadius: 12,
              border: '1.5px solid rgba(232,184,75,0.25)', background: '#fff',
              fontSize: 15, outline: 'none', fontFamily: "'Inter', sans-serif",
            }}
          />
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#8A8278' }}>🔍</span>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categoryFilters.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '7px 16px', borderRadius: 20,
              background: activeCategory === cat ? '#E8B84B' : '#FDF6E3',
              border: activeCategory === cat ? '1px solid #E8B84B' : '1px solid rgba(232,184,75,0.2)',
              color: activeCategory === cat ? '#3A3530' : '#8A8278',
              fontSize: 12, fontWeight: activeCategory === cat ? 600 : 400, cursor: 'pointer',
            }}>
              {cat}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={activeType} onChange={e => setActiveType(e.target.value)} style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(232,184,75,0.2)',
            background: '#fff', fontSize: 12, fontFamily: "'Inter', sans-serif", cursor: 'pointer',
          }}>
            {typeFilters.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(232,184,75,0.2)',
            background: '#fff', fontSize: 12, fontFamily: "'Inter', sans-serif", cursor: 'pointer',
          }}>
            <option value="rating">Highest Rated</option>
            <option value="reviews">Most Reviewed</option>
            <option value="price-low">Price: Low → High</option>
          </select>
          <span style={{ fontSize: 12, color: '#8A8278' }}>{filtered.length} practitioners</span>
        </div>
      </div>

      {/* Guide grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {filtered.map(guide => {
          const mainService = guide.services?.[0];
          const badge = mainService ? typeBadge(mainService.type) : null;
          return (
            <Link key={guide.id} href={`/guides/${guide.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 12,
                padding: 24, transition: 'box-shadow 0.3s, transform 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%', border: '3px solid #E8B84B',
                    background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 600, color: '#E8B84B', overflow: 'hidden', flexShrink: 0,
                    position: 'relative',
                  }}>
                    {guide.user?.avatarUrl ? (
                      <img src={guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      guide.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)
                    )}
                    {guide.isVerified && (
                      <span style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 22, height: 22, borderRadius: '50%', background: '#5A8A6A',
                        color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #fff',
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530', marginBottom: 2 }}>
                      {guide.displayName}
                    </h3>
                    {guide.tagline && <div style={{ fontSize: 12, color: '#8A8278', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guide.tagline}</div>}
                  </div>
                </div>

                {/* Rating + location */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#E8B84B', fontSize: 12 }}>★</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#3A3530' }}>{guide.averageRating}</span>
                    <span style={{ fontSize: 11, color: '#8A8278' }}>({guide.totalReviews})</span>
                  </div>
                  {guide.location && (
                    <span style={{ fontSize: 11, color: '#8A8278' }}>📍 {guide.location}</span>
                  )}
                </div>

                {/* Modalities */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {(guide.modalities ?? []).slice(0, 3).map(m => (
                    <span key={m} style={{ padding: '3px 10px', borderRadius: 12, background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.15)', fontSize: 10, color: '#3A3530' }}>
                      {m}
                    </span>
                  ))}
                </div>

                {/* Price + type */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {mainService && (
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530' }}>
                      ${mainService.price}<span style={{ fontSize: 12, fontWeight: 400, color: '#8A8278' }}>/session</span>
                    </span>
                  )}
                  {badge && (
                    <span style={{ padding: '3px 10px', borderRadius: 12, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 600 }}>
                      {badge.label}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
