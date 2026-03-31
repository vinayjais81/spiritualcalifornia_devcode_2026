'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart.store';
import { CheckoutProgress } from '@/components/public/checkout/CheckoutProgress';
import { OrderSummary } from '@/components/public/checkout/OrderSummary';
import { PaymentForm } from '@/components/public/booking/PaymentForm';

export default function CheckoutPage() {
  const { items, getSubtotal, hasPhysicalItems, clearCart } = useCartStore();
  const subtotal = getSubtotal();
  const hasPhysical = hasPhysicalItems();
  const [shipping, setShipping] = useState(hasPhysical ? 12 : 0);
  const [discount, setDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState('');
  const tax = hasPhysical ? Math.round(subtotal * 0.0863 * 100) / 100 : 0;
  const total = subtotal - discount + shipping + tax;
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phone: '', street: '', apt: '', city: '', state: 'CA', zip: '', country: 'US' });
  const inp = (key: string, label: string, opts?: { type?: string; placeholder?: string; full?: boolean }) => (
    <div style={{ gridColumn: opts?.full ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
      <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8A8278' }}>{label}</label>
      <input value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} type={opts?.type || 'text'} placeholder={opts?.placeholder}
        style={{ padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }} />
    </div>
  );

  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>✓</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>Order Confirmed!</h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>A confirmation email has been sent. Digital items are available for download now.</p>
        <Link href="/shop" style={{ padding: '14px 32px', borderRadius: 8, background: '#E8B84B', color: '#3A3530', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}>Continue Shopping</Link>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 48px', background: '#fff', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530' }}>Secure Checkout</span>
        <span style={{ marginLeft: 10, fontSize: 12, color: '#8A8278' }}>🔒</span>
      </div>
      <CheckoutProgress steps={['Cart', 'Checkout', 'Confirmation']} current={1} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px 80px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 48 }}>
        <div>
          {/* Express checkout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <button style={{ padding: '14px', borderRadius: 8, background: '#000', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}> Apple Pay</button>
            <button style={{ padding: '14px', borderRadius: 8, background: '#0070ba', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}> PayPal</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.15)' }} />
            <span style={{ fontSize: 12, color: '#8A8278' }}>Or pay with card</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.15)' }} />
          </div>

          {/* Contact */}
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Contact Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
            {inp('email', 'Email', { type: 'email', full: true })}
            {inp('firstName', 'First Name')}
            {inp('lastName', 'Last Name')}
          </div>

          {/* Shipping (if physical) */}
          {hasPhysical && (
            <>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Shipping Address</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {inp('street', 'Street Address', { full: true })}
                {inp('apt', 'Apt / Suite', { full: true })}
                {inp('city', 'City')}
                {inp('state', 'State')}
                {inp('zip', 'ZIP Code')}
                {inp('country', 'Country')}
              </div>

              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Shipping Method</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {[
                  { price: 12, label: 'Standard', desc: '7-14 business days' },
                  { price: 28, label: 'Express', desc: '3-5 business days' },
                  { price: 45, label: 'International Priority', desc: '5-10 business days' },
                ].map(s => (
                  <button key={s.price} onClick={() => setShipping(s.price)} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 8,
                    background: shipping === s.price ? '#FDF6E3' : '#fff',
                    border: shipping === s.price ? '1.5px solid #E8B84B' : '1.5px solid rgba(232,184,75,0.15)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                    <div><div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530' }}>{s.label}</div><div style={{ fontSize: 11, color: '#8A8278' }}>{s.desc}</div></div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#3A3530' }}>${s.price}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Payment */}
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Payment</div>
          <PaymentForm
            tabs={hasPhysical ? ['Credit / Debit', 'Bank Transfer', 'Crypto'] : ['Credit / Debit', 'Bank Transfer']}
            submitLabel={`Complete Purchase — $${total.toFixed(2)}`}
            onSubmit={() => { clearCart(); setDone(true); }}
          />

          {/* Trust */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 24 }}>
            {['🔒 SSL Encrypted', '↩️ 30-Day Returns', '💬 24h Support'].map(t => (
              <span key={t} style={{ fontSize: 11, color: '#8A8278' }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <OrderSummary
          items={items}
          subtotal={subtotal}
          shipping={shipping}
          tax={tax}
          discount={discount}
          total={total}
          promoApplied={promoApplied || undefined}
          onApplyPromo={(code) => { if (code.toUpperCase() === 'WELCOME40') { setDiscount(Math.min(subtotal * 0.4, 250)); setPromoApplied('WELCOME40'); } }}
        />
      </div>
    </>
  );
}
