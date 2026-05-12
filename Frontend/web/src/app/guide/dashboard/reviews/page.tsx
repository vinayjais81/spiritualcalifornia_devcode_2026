'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { C, font, formatDate, PageHeader, Panel, EmptyState } from '@/components/guide/dashboard-ui';

type TargetType = 'SERVICE' | 'EVENT' | 'TOUR' | 'PRODUCT';
type Filter = 'ALL' | TargetType;

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  targetType: TargetType;
  isApproved: boolean;
  isFlagged: boolean;
  createdAt: string;
  author: { firstName: string; lastName: string };
}

const TABS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'SERVICE', label: 'Services' },
  { key: 'EVENT', label: 'Events' },
  { key: 'TOUR', label: 'Tours' },
  { key: 'PRODUCT', label: 'Products' },
];

const TYPE_LABEL: Record<TargetType, string> = {
  SERVICE: 'Session',
  EVENT: 'Event',
  TOUR: 'Tour',
  PRODUCT: 'Product',
};

export default function ReviewsPage() {
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');

  useEffect(() => {
    if (!user?.id) return;
    api.get('/reviews/received').then(r => setReviews(r.data || [])).catch(() => setReviews([]));
  }, [user?.id]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? reviews : reviews.filter((r) => r.targetType === filter)),
    [reviews, filter],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: reviews.length, SERVICE: 0, EVENT: 0, TOUR: 0, PRODUCT: 0 };
    reviews.forEach((r) => { c[r.targetType]++; });
    return c;
  }, [reviews]);

  return (
    <div>
      <PageHeader title="Reviews & Testimonials" subtitle="Feedback from your clients across every offering. Reviews are verified and cannot be edited." />

      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, fontStyle: 'italic', marginBottom: '20px', padding: '8px 14px', background: C.offWhite, borderRadius: '6px', borderLeft: '3px solid rgba(232,184,75,0.4)' }}>
        🔒 Reviews are submitted directly by clients after a verified purchase. You cannot edit or delete reviews — flag inappropriate content to an admin.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              style={{
                padding: '10px 16px',
                fontFamily: font, fontSize: 12, fontWeight: active ? 600 : 500,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: active ? C.charcoal : C.warmGray,
                background: 'transparent', border: 'none',
                borderBottom: active ? `2px solid ${C.gold}` : '2px solid transparent',
                cursor: 'pointer', marginBottom: -1,
              }}
            >
              {t.label} <span style={{ color: C.warmGray, fontWeight: 400, marginLeft: 4 }}>({counts[t.key]})</span>
            </button>
          );
        })}
      </div>

      <Panel title="Recent Reviews" icon="💬">
        {filtered.length === 0 ? (
          <EmptyState message="No reviews here yet. Reviews appear once a client completes a verified purchase in this category." />
        ) : (
          filtered.map((r) => (
            <div key={r.id} style={{ padding: '18px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                  {r.author.firstName[0]}
                </div>
                <div>
                  <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>
                    {r.author.firstName} {r.author.lastName?.[0]}.
                  </div>
                  <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>
                    {formatDate(r.createdAt)} · {TYPE_LABEL[r.targetType]}
                    {r.isFlagged && <span style={{ marginLeft: 8, color: '#C0392B' }}>· Flagged</span>}
                    {!r.isApproved && <span style={{ marginLeft: 8, color: '#C0392B' }}>· Hidden by admin</span>}
                  </div>
                </div>
                <div style={{ color: C.gold, fontSize: '14px', letterSpacing: '2px', marginLeft: 'auto' }}>
                  {'★'.repeat(r.rating)}
                </div>
              </div>
              {r.title && (
                <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 600, color: C.charcoal, marginBottom: 4 }}>
                  {r.title}
                </div>
              )}
              {r.body && (
                <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6 }}>
                  {r.body}
                </div>
              )}
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
