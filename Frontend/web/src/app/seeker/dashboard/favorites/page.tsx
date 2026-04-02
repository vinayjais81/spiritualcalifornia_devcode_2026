'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, PageHeader, Panel, EmptyState } from '@/components/guide/dashboard-ui';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/seekers/favorites')
      .then(r => setFavorites(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const removeFavorite = async (guideId: string) => {
    try {
      await api.delete(`/seekers/favorites/${guideId}`);
      setFavorites(prev => prev.filter(f => f.guideId !== guideId));
      toast.success('Removed from favorites');
    } catch {
      toast.error('Failed to remove');
    }
  };

  if (loading) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <PageHeader title="Favorite Guides" subtitle={`${favorites.length} saved guide${favorites.length !== 1 ? 's' : ''}`} />

      <Panel title="Saved Guides" icon="❤️">
        {favorites.length === 0 ? (
          <EmptyState message="No favorite guides yet. Browse practitioners and save the ones you love." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {favorites.map((fav: any) => {
              const guide = fav.guide;
              if (!guide) return null;
              return (
                <div key={fav.id} style={{ background: C.offWhite, border: '1px solid rgba(232,184,75,0.15)', borderRadius: '10px', padding: '20px', display: 'flex', gap: '14px', alignItems: 'center' }}>
                  {guide.user?.avatarUrl ? (
                    <img src={guide.user.avatarUrl} alt={guide.displayName} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(232,184,75,0.3)' }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: C.gold, border: '2px solid rgba(232,184,75,0.3)', flexShrink: 0 }}>
                      {guide.displayName?.[0] || '?'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{guide.displayName}</div>
                    {guide.tagline && <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guide.tagline}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      {guide.isVerified && <span style={{ fontFamily: font, fontSize: '10px', color: C.gold }}>✓ Verified</span>}
                      {guide.totalReviews > 0 && <span style={{ fontFamily: font, fontSize: '10px', color: C.warmGray }}>★ {guide.averageRating?.toFixed(1)} ({guide.totalReviews})</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <a href={`/guides/${guide.slug}`} style={{ padding: '5px 12px', borderRadius: '4px', fontFamily: font, fontSize: '11px', background: C.gold, color: C.white, textDecoration: 'none' }}>View</a>
                      <a href={`/book/${guide.slug}`} style={{ padding: '5px 12px', borderRadius: '4px', fontFamily: font, fontSize: '11px', background: C.charcoal, color: C.gold, textDecoration: 'none' }}>Book</a>
                      <button onClick={() => removeFavorite(fav.guideId)} style={{ padding: '5px 12px', borderRadius: '4px', fontFamily: font, fontSize: '11px', background: 'transparent', color: C.red, border: '1px solid rgba(192,57,43,0.3)', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
