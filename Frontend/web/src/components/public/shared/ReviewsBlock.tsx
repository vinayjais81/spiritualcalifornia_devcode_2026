'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type TargetType = 'SERVICE' | 'EVENT' | 'TOUR' | 'PRODUCT';

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  author: { firstName: string; lastName: string; avatarUrl: string | null };
}

interface ReviewsResponse {
  reviews: ReviewItem[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const displayName = (a: { firstName: string; lastName: string }) =>
  `${a.firstName} ${(a.lastName?.[0] ?? '').toUpperCase()}${a.lastName ? '.' : ''}`.trim();
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export function ReviewsBlock({
  targetType,
  targetEntityId,
  columns = 3,
  pageSize = 6,
  showEmptyState = true,
}: {
  targetType: TargetType;
  targetEntityId: string;
  columns?: 2 | 3;
  pageSize?: number;
  showEmptyState?: boolean;
}) {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/reviews/for', { params: { targetType, targetEntityId, page, limit: pageSize } })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [targetType, targetEntityId, page, pageSize]);

  if (loading && !data) {
    return (
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '40px 60px', textAlign: 'center', color: '#8A8278', fontSize: 13 }}>
        Loading reviews…
      </div>
    );
  }

  if (!data || data.totalReviews === 0) {
    if (!showEmptyState) return null;
    return (
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '40px 60px 60px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          Reviews
          <span style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
        </div>
        <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#8A8278', fontStyle: 'italic' }}>
          No reviews yet — be the first once you experience it.
        </div>
      </div>
    );
  }

  const { reviews, averageRating, totalReviews, ratingDistribution, pagination } = data;
  const totalBars = Math.max(totalReviews, 1);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 60px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            Reviews
            <span style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 300, color: '#3A3530' }}>
              {averageRating.toFixed(1)}
            </span>
            <div>
              <div style={{ color: '#E8B84B', fontSize: 16, marginBottom: 4 }}>{stars(averageRating)}</div>
              <span style={{ fontSize: 13, color: '#8A8278' }}>
                {totalReviews} review{totalReviews !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Rating distribution bars */}
        <div style={{ minWidth: 240 }}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingDistribution[star] ?? 0;
            const pct = (count / totalBars) * 100;
            return (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ width: 12, fontSize: 11, color: '#8A8278' }}>{star}</span>
                <span style={{ color: '#E8B84B', fontSize: 10 }}>★</span>
                <div style={{ flex: 1, height: 6, background: 'rgba(232,184,75,0.12)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#E8B84B' }} />
                </div>
                <span style={{ width: 24, textAlign: 'right', fontSize: 11, color: '#8A8278' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: columns === 2 ? 28 : 24 }}>
        {reviews.map((r) => (
          <div key={r.id} style={{ background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: '#E8B84B', overflow: 'hidden' }}>
                {r.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.author.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (r.author.firstName?.[0] ?? '✦').toUpperCase()
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{displayName(r.author)}</div>
                <div style={{ fontSize: 11, color: '#8A8278' }}>Verified purchase · {formatDate(r.createdAt)}</div>
              </div>
              <div style={{ color: '#E8B84B', fontSize: 12 }}>{stars(r.rating)}</div>
            </div>
            {r.title && <div style={{ fontSize: 14, fontWeight: 600, color: '#3A3530', marginBottom: 6 }}>{r.title}</div>}
            {r.body && (
              <p style={{ fontSize: 13, color: '#3A3530', lineHeight: 1.7, fontStyle: 'italic' }}>
                &ldquo;{r.body}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.3)', background: 'transparent', fontSize: 12, color: '#3A3530', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
          >
            ← Previous
          </button>
          <span style={{ padding: '8px 16px', fontSize: 12, color: '#8A8278' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.3)', background: 'transparent', fontSize: 12, color: '#3A3530', cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer', opacity: page === pagination.totalPages ? 0.5 : 1 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
