'use client';

import { C, font, serif, PageHeader, Panel, Btn } from '@/components/guide/dashboard-ui';

export default function SubscriptionPage() {
  return (
    <div>
      <PageHeader title="Subscription Plan" subtitle="Your listing plan on Spiritual California." />

      <div style={{ border: `2px solid ${C.gold}`, borderRadius: '12px', padding: '24px', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ fontFamily: serif, fontSize: '22px', fontWeight: 500, color: C.charcoal }}>Free Listing Period</div>
          <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, marginTop: '3px' }}>$0/month for your first 3 months</div>
        </div>
        <span style={{ padding: '5px 14px', borderRadius: '20px', background: C.green, color: C.white, fontFamily: font, fontSize: '11px', fontWeight: 500 }}>Active</span>
      </div>

      <Panel title="After Your Free Period" icon="⭐">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ padding: '24px', border: `2px solid ${C.gold}`, borderRadius: '12px', background: C.goldPale }}>
            <div style={{ fontFamily: serif, fontSize: '22px', fontWeight: 500, color: C.charcoal, marginBottom: '6px' }}>Standard Listing</div>
            <div style={{ fontFamily: serif, fontSize: '36px', fontWeight: 400, color: C.gold, marginBottom: '12px' }}>$50<span style={{ fontSize: '16px', color: C.warmGray }}>/month</span></div>
            {['Full profile listing', 'Unlimited blog posts (1/day)', 'Services & products listing', 'Calendly booking integration', 'Verified badge eligibility', 'Events listing'].map(f => (
              <div key={f} style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, marginBottom: '8px' }}>✓ {f}</div>
            ))}
            <Btn style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}>Subscribe — $50/month</Btn>
          </div>
          <div style={{ padding: '24px', border: '1px solid rgba(232,184,75,0.2)', borderRadius: '12px' }}>
            <div style={{ fontFamily: serif, fontSize: '22px', fontWeight: 500, color: C.charcoal, marginBottom: '6px' }}>Annual Plan</div>
            <div style={{ fontFamily: serif, fontSize: '36px', fontWeight: 400, color: C.charcoal, marginBottom: '12px' }}>$480<span style={{ fontSize: '16px', color: C.warmGray }}>/year</span></div>
            <div style={{ fontFamily: font, fontSize: '12px', color: C.green, fontWeight: 500, marginBottom: '12px' }}>Save $120 vs. monthly</div>
            {['Everything in Standard', 'Priority placement in search', 'Featured in monthly newsletter'].map(f => (
              <div key={f} style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, marginBottom: '8px' }}>✓ {f}</div>
            ))}
            <Btn variant="secondary" style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}>Subscribe — $480/year</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}
