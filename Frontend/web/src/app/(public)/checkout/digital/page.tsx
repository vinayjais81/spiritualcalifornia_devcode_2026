'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart.store';
import { CheckoutProgress } from '@/components/public/checkout/CheckoutProgress';
import { OrderSummary } from '@/components/public/checkout/OrderSummary';
import { PaymentForm } from '@/components/public/booking/PaymentForm';

export default function DigitalCheckoutPage() {
  const { items, getSubtotal, clearCart } = useCartStore();
  const subtotal = getSubtotal();
  const total = subtotal;
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', emailConfirm: '' });

  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>⬇️</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>Your Downloads Are Ready!</h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>Check your email for download links. You can also access them from your account dashboard.</p>
        <Link href="/shop" style={{ padding: '14px 32px', borderRadius: 8, background: '#E8B84B', color: '#3A3530', fontSize: 12, fontWeight: 600, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Continue Shopping</Link>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 48px', background: '#fff', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
        <Link href="/cart" style={{ position: 'absolute', left: 48, fontSize: 12, color: '#8A8278', textDecoration: 'none' }}>← Back to cart</Link>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530' }}>Checkout</span>
      </div>
      <CheckoutProgress steps={['Cart', 'Checkout', 'Download']} current={1} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px 80px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 48 }}>
        <div>
          {/* Instant delivery banner */}
          <div style={{
            background: '#3A3530', borderRadius: 12, padding: '20px 24px', marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(232,184,75,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚡</div>
            <div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#E8B84B', marginBottom: 2 }}>Instant Digital Delivery</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Your files will be available immediately after payment. No shipping required.</p>
            </div>
          </div>

          {/* Express */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <button style={{ padding: '14px', borderRadius: 8, background: '#000', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}> Apple Pay</button>
            <button style={{ padding: '14px', borderRadius: 8, background: '#0070ba', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}> PayPal</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.15)' }} />
            <span style={{ fontSize: 12, color: '#8A8278' }}>or pay with card</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.15)' }} />
          </div>

          {/* Email form */}
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Your Email</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
            {['firstName', 'lastName', 'email', 'emailConfirm'].map((key, i) => (
              <div key={key} style={{ gridColumn: i >= 2 ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278' }}>
                  {['First Name', 'Last Name', 'Email Address', 'Confirm Email'][i]}
                </label>
                <input value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} type={i >= 2 ? 'email' : 'text'}
                  style={{ padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }} />
              </div>
            ))}
          </div>

          {/* Payment */}
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Payment</div>
          <PaymentForm
            tabs={['Credit / Debit', 'Bank Transfer']}
            submitLabel={`Complete Purchase — $${total.toFixed(2)}`}
            onSubmit={() => { clearCart(); setDone(true); }}
          />

          {/* What happens next */}
          <div style={{ background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)', borderRadius: 12, padding: '24px', marginTop: 28 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#3A3530', marginBottom: 16 }}>What Happens Next</h4>
            {[
              'Payment is confirmed instantly',
              'Download links sent to your email',
              'Access files from your account anytime',
              'Links are valid for lifetime re-downloads',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#E8B84B', color: '#3A3530', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: '#3A3530' }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <OrderSummary
          items={items}
          subtotal={subtotal}
          shipping={0}
          tax={0}
          total={total}
          note="Lifetime access — re-download anytime"
        />
      </div>
    </>
  );
}
