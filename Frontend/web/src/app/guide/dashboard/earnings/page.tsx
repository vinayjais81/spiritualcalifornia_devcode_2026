'use client';

import { C, font, serif, PageHeader, Panel, Btn, EmptyState } from '@/components/guide/dashboard-ui';

export default function EarningsPage() {
  return (
    <div>
      <PageHeader title="Earnings & Payouts" subtitle="Track your income and transfer funds to your bank account." />

      <div style={{ background: 'linear-gradient(135deg, #2C2420 0%, #4A3C30 100%)', borderRadius: '12px', padding: '32px', color: C.white, marginBottom: '28px' }}>
        <div style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Available Balance</div>
        <div style={{ fontFamily: serif, fontSize: '52px', fontWeight: 400, color: C.gold, lineHeight: 1, marginBottom: '6px' }}>$0.00</div>
        <div style={{ fontFamily: font, fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>From services and product sales on Spiritual California</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Btn>💸 Cash Out</Btn>
          <Btn variant="secondary" style={{ background: 'rgba(255,255,255,0.1)', color: C.white, borderColor: 'rgba(255,255,255,0.2)' }}>Link Bank Account</Btn>
        </div>
        <div style={{ fontFamily: font, fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '12px' }}>Minimum cashout: $100. Transfers arrive within 3–5 business days.</div>
      </div>

      <Panel title="Recent Transactions" icon="📊">
        <EmptyState message="No transactions yet. Earnings will appear here once bookings or product sales occur." />
      </Panel>
    </div>
  );
}
