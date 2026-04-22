'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart.store';
import { CheckoutProgress } from '@/components/public/checkout/CheckoutProgress';
import { OrderSummary } from '@/components/public/checkout/OrderSummary';
import { PaymentForm } from '@/components/public/booking/PaymentForm';
import { useSiteConfigOrFallback } from '@/lib/siteConfig';

interface Attendee { firstName: string; lastName: string; email: string; requirements: string; }

export default function EventCheckoutPage() {
  const { items, getSubtotal, clearCart } = useCartStore();
  const siteConfig = useSiteConfigOrFallback();
  const bookingFeeRate = siteConfig.fees.eventBookingFeePercent / 100;
  const eventItems = items.filter(i => i.itemType === 'EVENT_TICKET');
  const subtotal = getSubtotal();
  const bookingFee = Math.round(subtotal * bookingFeeRate * 100) / 100;
  const total = subtotal + bookingFee;
  const ticketCount = eventItems.reduce((sum, i) => sum + i.quantity, 0) || 2;
  const [attendees, setAttendees] = useState<Attendee[]>(
    Array.from({ length: ticketCount }, () => ({ firstName: '', lastName: '', email: '', requirements: '' })),
  );
  const [done, setDone] = useState(false);

  const updateAttendee = (index: number, field: keyof Attendee, value: string) => {
    setAttendees(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🎫</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>Your Tickets Are Confirmed!</h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>E-tickets with QR codes have been sent to each attendee&apos;s email.</p>
        <Link href="/events" style={{ padding: '14px 32px', borderRadius: 8, background: '#E8B84B', color: '#3A3530', fontSize: 12, fontWeight: 600, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Browse More Events</Link>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 48px', background: '#fff', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
        <Link href="/cart" style={{ position: 'absolute', left: 48, fontSize: 12, color: '#8A8278', textDecoration: 'none' }}>← Back to cart</Link>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530' }}>Event Checkout</span>
      </div>
      <CheckoutProgress steps={['Cart', 'Attendee Details', 'Payment', 'Your Tickets']} current={1} />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 48px 80px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48 }}>
        <div>
          {/* Event card */}
          {eventItems[0] && (
            <div style={{
              background: '#3A3530', borderRadius: 12, padding: '20px 24px', marginBottom: 28,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{ width: 80, height: 80, borderRadius: 8, background: 'rgba(232,184,75,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎭</div>
              <div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#F5D98A', marginBottom: 4 }}>{eventItems[0].name}</h3>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {['📅 Date TBD', '🕐 Time TBD', '📍 Location TBD'].map(m => (
                    <span key={m} style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Attendee cards */}
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14 }}>
            Attendee Information
          </div>
          {attendees.map((att, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#E8B84B', color: '#3A3530', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#3A3530' }}>Attendee {i + 1}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {(['firstName', 'lastName', 'email', 'requirements'] as const).map((field, fi) => (
                  <div key={field} style={{ gridColumn: fi >= 2 ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278' }}>
                      {['First Name', 'Last Name', 'Email', 'Dietary / Accessibility Needs'][fi]}
                    </label>
                    {field === 'requirements' ? (
                      <textarea value={att[field]} onChange={e => updateAttendee(i, field, e.target.value)} rows={2}
                        style={{ padding: '10px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, fontFamily: "'Inter', sans-serif", resize: 'vertical', outline: 'none' }} />
                    ) : (
                      <input value={att[field]} onChange={e => updateAttendee(i, field, e.target.value)} type={field === 'email' ? 'email' : 'text'}
                        style={{ padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Payment */}
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 14, marginTop: 8 }}>Payment</div>
          <PaymentForm
            tabs={['Credit / Debit', 'Apple Pay', 'PayPal']}
            submitLabel={`Confirm & Pay — $${total.toFixed(2)} (${ticketCount} ticket${ticketCount > 1 ? 's' : ''})`}
            onSubmit={() => { clearCart(); setDone(true); }}
            cancellationNote={siteConfig.cancellationPolicies.event.text}
          />
        </div>

        {/* Sidebar */}
        <div>
          <OrderSummary
            items={eventItems}
            subtotal={subtotal}
            tax={bookingFee}
            total={total}
            note="Each attendee will receive a unique QR code ticket"
          >
            {/* QR Preview */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{ background: '#FDF6E3', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 10 }}>
                  Your tickets after payment
                </div>
                <div style={{ width: 80, height: 80, background: '#3A3530', borderRadius: 6, margin: '0 auto 10px' }} />
                <div style={{ fontSize: 10, color: '#8A8278' }}>Unique QR code per attendee</div>
              </div>
            </div>
          </OrderSummary>
        </div>
      </div>
    </>
  );
}
