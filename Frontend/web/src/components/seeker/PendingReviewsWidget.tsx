'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type TargetType = 'SERVICE' | 'EVENT' | 'TOUR' | 'PRODUCT';

interface Reviewable {
  services: any[];
  events: any[];
  tours: any[];
  products: any[];
}

interface Row {
  key: string;
  targetType: TargetType;
  transactionId: string;
  title: string;
  subtitle: string;
}

function flatten(data: Reviewable): Row[] {
  const rows: Row[] = [];
  for (const b of data.services ?? []) {
    rows.push({
      key: `s-${b.id}`,
      targetType: 'SERVICE',
      transactionId: b.id,
      title: b.service?.name ?? 'Session',
      subtitle: `with ${b.service?.guide?.displayName ?? 'your guide'}`,
    });
  }
  for (const t of data.events ?? []) {
    rows.push({
      key: `e-${t.id}`,
      targetType: 'EVENT',
      transactionId: t.id,
      title: t.tier?.event?.title ?? 'Event',
      subtitle: `Hosted by ${t.tier?.event?.guide?.displayName ?? 'your guide'}`,
    });
  }
  for (const tb of data.tours ?? []) {
    rows.push({
      key: `t-${tb.id}`,
      targetType: 'TOUR',
      transactionId: tb.id,
      title: tb.tour?.title ?? 'Tour',
      subtitle: `Led by ${tb.tour?.guide?.displayName ?? 'your guide'}`,
    });
  }
  for (const oi of data.products ?? []) {
    rows.push({
      key: `p-${oi.id}`,
      targetType: 'PRODUCT',
      transactionId: oi.id,
      title: oi.product?.name ?? 'Product',
      subtitle: `From ${oi.product?.guide?.displayName ?? 'your guide'}`,
    });
  }
  return rows;
}

const BADGE_LABEL: Record<TargetType, string> = {
  SERVICE: 'Session',
  EVENT: 'Event',
  TOUR: 'Tour',
  PRODUCT: 'Product',
};

export function PendingReviewsWidget() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    api
      .get('/reviews/reviewable')
      .then((res) => setRows(flatten(res.data)))
      .catch(() => setRows([]));
  }, []);

  if (rows === null) return null;
  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 32, padding: '20px 24px', background: '#FEF7F0', border: '1px solid rgba(232,184,75,0.25)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>★</span>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#3A3530' }}>
            Share your experience
          </div>
          <div style={{ fontSize: 12, color: '#8A8278' }}>
            {rows.length} purchase{rows.length === 1 ? '' : 's'} ready for a review
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.slice(0, 4).map((r) => (
          <Link
            key={r.key}
            href={`/reviews/new?targetType=${r.targetType}&transactionId=${r.transactionId}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: '#fff', borderRadius: 8, border: '1px solid rgba(232,184,75,0.15)',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <span style={{
              fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '4px 8px', borderRadius: 4, background: 'rgba(232,184,75,0.15)', color: '#8A6E1F',
            }}>
              {BADGE_LABEL[r.targetType]}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530' }}>{r.title}</div>
              <div style={{ fontSize: 11, color: '#8A8278' }}>{r.subtitle}</div>
            </div>
            <span style={{ fontSize: 11, color: '#F07814', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
              Write review →
            </span>
          </Link>
        ))}
      </div>

      {rows.length > 4 && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#8A8278', textAlign: 'center' }}>
          And {rows.length - 4} more…
        </div>
      )}
    </div>
  );
}
