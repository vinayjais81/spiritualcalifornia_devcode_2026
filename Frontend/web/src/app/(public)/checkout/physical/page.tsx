'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart.store';
import { CheckoutProgress } from '@/components/public/checkout/CheckoutProgress';
import { OrderSummary } from '@/components/public/checkout/OrderSummary';
import { PaymentForm } from '@/components/public/booking/PaymentForm';

export default function PhysicalCheckoutPage() {
  const { items, getSubtotal, hasDigitalItems, clearCart } = useCartStore();
  const subtotal = getSubtotal();
  const hasDigital = hasDigitalItems();
  const [shipping, setShipping] = useState(12);
  const tax = Math.round(subtotal * 0.0863 * 100) / 100;
  const total = subtotal + shipping + tax;
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', country: 'US', street: '', apt: '', city: '', state: 'CA', zip: '' });

  const inp = (key: string, label: string, opts?: { type?: string; col?: string }) => (
    <div style={{ gridColumn: opts?.col, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
      <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8A8278' }}>{label}</label>
      <input value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} type={opts?.type || 'text'}
        style={{ padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }} />
    </div>
  );

  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📦</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>Order Confirmed!</h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>Shipping confirmation will be sent once your items are dispatched.{hasDigital && ' Digital items are available for download now.'}</p>
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
      <CheckoutProgress steps={['Cart', 'Checkout', 'Confirmation']} current={1} />

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '40px 48px 80px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48 }}>
        <div>
          {hasDigital && (
            <div style={{ background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 12, color: '#3A3530', display: 'flex', gap: 8 }}>
              <span>⚡</span> Digital items in your order will be delivered instantly after payment.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <button style={{ padding: '14px', borderRadius: 8, background: '#000', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}> Apple Pay</button>
            <button style={{ padding: '14px', borderRadius: 8, background: '#0070ba', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}> PayPal</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}><div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.15)' }} /><span style={{ fontSize: 12, color: '#8A8278' }}>or pay with card</span><div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.15)' }} /></div>

          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Contact Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
            {inp('firstName', 'First Name')}{inp('lastName', 'Last Name')}{inp('email', 'Email', { col: '1 / -1', type: 'email' })}{inp('phone', 'Phone (optional)', { col: '1 / -1', type: 'tel' })}
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Shipping Address</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 28 }}>
            {inp('street', 'Street Address', { col: '1 / -1' })}{inp('apt', 'Apt / Suite', { col: '1 / -1' })}{inp('city', 'City')}{inp('state', 'State')}{inp('zip', 'ZIP Code')}
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Shipping Method</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {[{ price: 12, label: 'Standard', desc: '7-14 business days' }, { price: 28, label: 'Express', desc: '3-5 business days' }, { price: 45, label: 'International Priority', desc: '5-10 business days' }].map(s => (
              <button key={s.price} onClick={() => setShipping(s.price)} style={{
                display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 8, width: '100%', textAlign: 'left',
                background: shipping === s.price ? '#FDF6E3' : '#fff', border: shipping === s.price ? '1.5px solid #E8B84B' : '1.5px solid rgba(232,184,75,0.15)', cursor: 'pointer',
              }}>
                <div><div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530' }}>{s.label}</div><div style={{ fontSize: 11, color: '#8A8278' }}>{s.desc}</div></div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#3A3530' }}>${s.price}</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>Payment</div>
          <PaymentForm tabs={['Credit / Debit', 'Bank Transfer', 'Crypto']} submitLabel={`Complete Purchase — $${total.toFixed(2)}`} onSubmit={() => { clearCart(); setDone(true); }} />
        </div>

        <OrderSummary items={items} subtotal={subtotal} shipping={shipping} tax={tax} total={total} note="Made-to-order items may take 3-5 weeks to ship" />
      </div>
    </>
  );
}
