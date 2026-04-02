'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { C, font, PageHeader, Panel, EmptyState } from '@/components/guide/dashboard-ui';

const statusColors: Record<string, { bg: string; color: string; border: string }> = {
  SUCCEEDED: { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
  PENDING: { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  FAILED: { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A' },
  REFUNDED: { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9' },
  PARTIALLY_REFUNDED: { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9' },
};

function getPaymentLabel(p: any): { type: string; name: string } {
  if (p.booking) return { type: 'Service', name: p.booking.service?.name || 'Session' };
  if (p.order) return { type: 'Product', name: p.order.items?.[0]?.product?.name || 'Order' };
  if (p.ticketPurchase) return { type: 'Event', name: p.ticketPurchase.tier?.event?.title || 'Event Ticket' };
  if (p.tourBooking) return { type: 'Tour', name: p.tourBooking.tour?.title || 'Soul Tour' };
  return { type: 'Payment', name: 'Payment' };
}

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/seekers/payments')
      .then(r => setPayments(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;

  const totalSpent = payments.filter(p => p.status === 'SUCCEEDED').reduce((sum: number, p: any) => sum + Number(p.amount) / 100, 0);

  return (
    <div>
      <PageHeader title="Payment History" subtitle={`Total spent: $${totalSpent.toFixed(2)}`} />

      <Panel title="All Payments" icon="💳">
        {payments.length === 0 ? (
          <EmptyState message="No payments yet. Your transactions will appear here after your first booking." />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px', gap: '10px', padding: '0 0 10px', borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
              {['Description', 'Type', 'Date', 'Amount', 'Status'].map(h => (
                <div key={h} style={{ fontFamily: font, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.warmGray, fontWeight: 500 }}>{h}</div>
              ))}
            </div>
            {payments.map((p: any) => {
              const { type, name } = getPaymentLabel(p);
              const date = new Date(p.createdAt);
              const s = statusColors[p.status] || statusColors.PENDING;
              const amount = (Number(p.amount) / 100).toFixed(2);
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px', gap: '10px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(232,184,75,0.06)' }}>
                  <div>
                    <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>{name}</div>
                    {p.booking?.service?.guide?.displayName && <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>with {p.booking.service.guide.displayName}</div>}
                  </div>
                  <span style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{type}</span>
                  <span style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>${amount}</span>
                  <span style={{ padding: '3px 8px', borderRadius: '20px', fontFamily: font, fontSize: '10px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, textAlign: 'center' }}>
                    {p.status === 'SUCCEEDED' ? 'Paid' : p.status === 'PARTIALLY_REFUNDED' ? 'Partial Refund' : p.status}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </Panel>
    </div>
  );
}
