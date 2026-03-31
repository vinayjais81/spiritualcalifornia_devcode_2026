'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { C, font, formatDate, PageHeader, Panel, EmptyState } from '@/components/guide/dashboard-ui';

interface Review { id: string; rating: number; body: string | null; createdAt: string; author: { firstName: string; lastName: string }; }

export default function ReviewsPage() {
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (user?.id) {
      api.get(`/reviews/guide/${user.id}`).then(r => setReviews(r.data.reviews || [])).catch(() => {});
    }
  }, [user?.id]);

  return (
    <div>
      <PageHeader title="Reviews & Testimonials" subtitle="Feedback from your clients. Reviews are verified and cannot be edited." />

      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, fontStyle: 'italic', marginBottom: '20px', padding: '8px 14px', background: C.offWhite, borderRadius: '6px', borderLeft: '3px solid rgba(232,184,75,0.4)' }}>
        🔒 Reviews are submitted directly by clients and verified by Spiritual California. You cannot edit or delete reviews.
      </div>

      <Panel title="Recent Reviews" icon="💬">
        {reviews.length === 0 ? <EmptyState message="No reviews yet. Reviews will appear here once clients complete sessions." /> : reviews.map(r => (
          <div key={r.id} style={{ padding: '18px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                {r.author.firstName[0]}
              </div>
              <div>
                <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>{r.author.firstName} {r.author.lastName[0]}.</div>
                <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{formatDate(r.createdAt)}</div>
              </div>
              <div style={{ color: C.gold, fontSize: '14px', letterSpacing: '2px', marginLeft: 'auto' }}>{'★'.repeat(r.rating)}</div>
            </div>
            {r.body && <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6 }}>{r.body}</div>}
          </div>
        ))}
      </Panel>
    </div>
  );
}
