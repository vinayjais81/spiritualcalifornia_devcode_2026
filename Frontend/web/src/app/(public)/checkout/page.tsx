'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { CheckoutProgress } from '@/components/public/checkout/CheckoutProgress';
import { OrderSummary } from '@/components/public/checkout/OrderSummary';
import { StripeProvider } from '@/components/public/checkout/StripeProvider';
import { StripePaymentForm } from '@/components/public/checkout/StripePaymentForm';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ShippingMethod {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
}

interface TaxRate {
  id: string;
  state: string;
  country: string;
  rate: number | string;
  name: string;
}

interface OrderItemResponse {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number | string;
  downloadUrl?: string | null;
  product: {
    name: string;
    type: 'DIGITAL' | 'PHYSICAL';
    imageUrls?: string[];
  };
}

interface OrderResponse {
  id: string;
  status: string;
  totalAmount: number | string;
  items: OrderItemResponse[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function CheckoutPage() {
  const { items, getSubtotal, hasPhysicalItems, hasDigitalItems, clearCart } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const subtotal = getSubtotal();
  const hasPhysical = hasPhysicalItems();
  const hasDigital = hasDigitalItems();
  // Product items only — events + tours have their own checkout flows
  const productItems = useMemo(() => items.filter((i) => i.itemType === 'PRODUCT'), [items]);

  // Form state
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    street: '',
    apartment: '',
    city: '',
    state: 'CA',
    zipCode: '',
    country: 'US',
  });
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string>('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number } | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderResponse | null>(null);
  // Set once the order is created + Stripe PaymentIntent minted. Swapping this
  // value in replaces the "Continue to Payment" CTA with real Stripe Elements.
  const [pendingPayment, setPendingPayment] = useState<{ orderId: string; clientSecret: string } | null>(null);

  // Pre-fill the form for signed-in seekers. Two sources, in priority order:
  //   1. auth store (email + name are always available) — synchronous
  //   2. GET /orders/mine — pulls phone + last shipping address from the most
  //      recent order, so returning customers skip the address re-entry.
  // Fields remain editable; we only fill if the field is currently empty so we
  // never overwrite something the user has already typed.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setForm((prev) => ({
      ...prev,
      email: prev.email || user.email || '',
      firstName: prev.firstName || user.firstName || '',
      lastName: prev.lastName || user.lastName || '',
    }));
    api.get('/orders/mine')
      .then((r) => {
        const orders = Array.isArray(r.data) ? r.data : [];
        // Prefer the most recent PAID order — falls back to any recent order
        // if no paid ones yet (so address is still remembered between attempts).
        const pick =
          orders.find((o: any) => o.status === 'PAID' || o.status === 'DELIVERED') ||
          orders[0];
        if (!pick) return;
        const addr = pick.shippingAddress || {};
        setForm((prev) => ({
          ...prev,
          phone: prev.phone || pick.contactPhone || '',
          street: prev.street || addr.street || '',
          apartment: prev.apartment || addr.apartment || '',
          city: prev.city || addr.city || '',
          state: prev.state && prev.state !== 'CA' ? prev.state : (addr.state || prev.state || 'CA'),
          zipCode: prev.zipCode || addr.zipCode || '',
          country: prev.country && prev.country !== 'US' ? prev.country : (addr.country || prev.country || 'US'),
        }));
      })
      .catch(() => { /* silent — first-time customer has no orders yet */ });
  }, [isAuthenticated, user]);

  // Load shipping methods + tax rates on mount (only needed if cart has physical items)
  useEffect(() => {
    if (!hasPhysical) return;
    api.get('/checkout/shipping-methods').then((r) => {
      const list: ShippingMethod[] = r.data || [];
      setShippingMethods(list);
      if (list.length > 0 && !selectedShippingId) setSelectedShippingId(list[0].id);
    }).catch(() => {});
    api.get('/checkout/tax-rates').then((r) => setTaxRates(r.data || [])).catch(() => {});
  }, [hasPhysical]); // eslint-disable-line react-hooks/exhaustive-deps

  // Server-authoritative totals
  const shippingMethod = shippingMethods.find((s) => s.id === selectedShippingId);
  const shippingCost = hasPhysical && shippingMethod ? Number(shippingMethod.price) : 0;
  const taxRow = hasPhysical ? taxRates.find((t) => t.state === form.state) : undefined;
  const taxRate = taxRow ? Number(taxRow.rate) : 0;
  const discount = promoApplied?.discount ?? 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(discountedSubtotal * taxRate * 100) / 100;
  const total = discountedSubtotal + shippingCost + taxAmount;

  // ─── Submit handler ──────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (productItems.length === 0) return 'Your cart has no products to check out.';
    if (!form.email.trim()) return 'Please enter your email.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (!form.firstName.trim() || !form.lastName.trim()) return 'Please enter your name.';
    if (hasPhysical) {
      if (!form.street.trim()) return 'Please enter your shipping address.';
      if (!form.city.trim() || !form.state.trim() || !form.zipCode.trim()) return 'Please complete your shipping address.';
      if (!selectedShippingId) return 'Please choose a shipping method.';
    }
    return null;
  };

  // Step 1 → Step 2. Validates the form, posts the order, then swaps the
  // "Continue to Payment" CTA for real Stripe Elements using the returned
  // client secret. The order sits in PENDING until Stripe confirms the PI.
  const handleContinueToPayment = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSubmitting(true);
    try {
      const payload: any = {
        items: productItems.map((i) => ({
          productId: i.itemId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        contactEmail: form.email,
        contactFirstName: form.firstName,
        contactLastName: form.lastName,
        contactPhone: form.phone || undefined,
        promoCode: promoApplied?.code,
      };
      if (hasPhysical) {
        payload.shippingAddress = {
          street: form.street,
          apartment: form.apartment || undefined,
          city: form.city,
          state: form.state,
          zipCode: form.zipCode,
          country: form.country,
        };
        payload.shippingMethodId = selectedShippingId;
      }

      const { data } = await api.post('/orders', payload);
      const orderId: string = data?.order?.id;
      const clientSecret: string | undefined = data?.paymentIntent?.clientSecret;
      if (!orderId || !clientSecret) {
        throw new Error('Checkout failed: server did not return a payment intent.');
      }
      setPendingPayment({ orderId, clientSecret });
      // Scroll the payment section into view so the user sees the card field appear
      setTimeout(() => {
        document.getElementById('checkout-payment-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Checkout failed. Please try again.';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Stripe callback: card confirmed successfully. Actively call the backend
  // confirm endpoint (fallback for environments where the Stripe webhook isn't
  // wired yet — e.g. local dev without `stripe listen`). That single call
  // flips the order to PAID, generates 7-day download URLs, and triggers the
  // confirmation email. We then fetch the fresh order so the confirmation
  // screen can surface the inline download CTAs.
  const handleStripeSuccess = async (paymentIntentId: string) => {
    if (!pendingPayment) return;
    try {
      await api.post('/payments/confirm-payment', { paymentIntentId });
    } catch {
      // Ignore — the Stripe webhook may have already fired. Polling below
      // will still return the PAID order if that's the case.
    }
    clearCart();
    const finalOrder = await pollOrderPaid(pendingPayment.orderId, 6);
    setConfirmedOrder(finalOrder);
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    try {
      const { data } = await api.post('/checkout/validate-promo', { code: promoCode.trim(), subtotal });
      setPromoApplied({ code: promoCode.trim(), discount: Number(data.discountAmount) || 0 });
      toast.success('Promo applied');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Invalid promo code');
    }
  };

  // ─── Render: success screen ──────────────────────────────────────────────

  if (confirmedOrder) {
    return <ConfirmationScreen order={confirmedOrder} />;
  }

  if (productItems.length === 0) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🛒</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: '#3A3530', marginBottom: 10 }}>
          Your cart is empty
        </h1>
        <Link href="/shop" style={ctaStyle}>Browse the Shop</Link>
      </div>
    );
  }

  // ─── Render: checkout form ───────────────────────────────────────────────

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 48px', background: '#fff', borderBottom: '1px solid rgba(232,184,75,0.1)', position: 'relative' }}>
        <Link href="/cart" style={{ position: 'absolute', left: 48, fontSize: 12, color: '#8A8278', textDecoration: 'none' }}>← Back to cart</Link>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530' }}>
          Secure Checkout <span style={{ marginLeft: 8, fontSize: 12 }}>🔒</span>
        </span>
      </div>
      <CheckoutProgress
        steps={hasPhysical
          ? (hasDigital ? ['Cart', 'Checkout', 'Confirmation'] : ['Cart', 'Checkout', 'Shipping'])
          : ['Cart', 'Checkout', 'Download']}
        current={1}
      />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px 80px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 48 }}>
        <div>
          {/* Instant-delivery banner — shown when cart has any digital item */}
          {hasDigital && (
            <div style={{
              background: '#3A3530', borderRadius: 10,
              padding: '20px 24px', marginBottom: 28,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 40, height: 40, background: 'rgba(232,184,75,0.15)',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 20,
              }}>⚡</div>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, color: '#F5D98A', marginBottom: 4 }}>
                  {hasPhysical ? 'Mixed order — digital items ship instantly' : 'Instant Digital Delivery'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  {hasPhysical
                    ? 'Your digital items become available to download the moment payment is confirmed. Physical items ship according to the method you select below.'
                    : 'Your download links will be emailed the moment payment is confirmed — no shipping, no waiting.'}
                </div>
              </div>
            </div>
          )}

          {/* Contact — always required */}
          <SectionTitle>Contact Information</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
            <Input label="Email" full value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" placeholder="you@example.com" />
            <Input label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
            <Input label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
            {hasPhysical && (
              <Input label="Phone" full value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="For delivery updates" />
            )}
          </div>

          {/* Shipping — only when cart has physical items */}
          {hasPhysical && (
            <>
              <SectionTitle>Shipping Address</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <Input label="Street Address" full value={form.street} onChange={(v) => setForm({ ...form, street: v })} />
                <Input label="Apt / Suite (optional)" full value={form.apartment} onChange={(v) => setForm({ ...form, apartment: v })} />
                <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <Input label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} placeholder="CA" />
                <Input label="ZIP Code" value={form.zipCode} onChange={(v) => setForm({ ...form, zipCode: v })} />
                <Input label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} placeholder="US" />
              </div>

              <SectionTitle>Shipping Method</SectionTitle>
              {shippingMethods.length === 0 ? (
                <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 28 }}>Loading shipping options…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {shippingMethods.map((s) => {
                    const selected = selectedShippingId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedShippingId(s.id)}
                        style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '14px 16px', borderRadius: 8, width: '100%', textAlign: 'left',
                          background: selected ? '#FDF6E3' : '#fff',
                          border: `1.5px solid ${selected ? '#E8B84B' : 'rgba(232,184,75,0.15)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: '#8A8278' }}>
                            {s.description || (s.estimatedDaysMin
                              ? `${s.estimatedDaysMin}–${s.estimatedDaysMax} business days`
                              : '')}
                          </div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#3A3530' }}>
                          {Number(s.price) === 0 ? 'Free' : `$${Number(s.price).toFixed(2)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Payment */}
          <div id="checkout-payment-section">
            <SectionTitle>Payment</SectionTitle>
            {pendingPayment ? (
              <>
                <div style={{
                  fontSize: 11, color: '#5A8A6A', marginBottom: 14,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>✓</span> Order created. Complete payment to finalise your purchase.
                  <button
                    type="button"
                    onClick={() => setPendingPayment(null)}
                    style={{
                      marginLeft: 'auto', background: 'none', border: 'none',
                      color: '#8A8278', fontSize: 11, cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Edit details
                  </button>
                </div>
                <StripeProvider clientSecret={pendingPayment.clientSecret}>
                  <StripePaymentForm
                    submitLabel={`Complete Purchase — $${total.toFixed(2)}`}
                    onSuccess={handleStripeSuccess}
                    onError={(msg) => toast.error(msg)}
                    returnUrl={typeof window !== 'undefined' ? `${window.location.origin}/checkout` : '/checkout'}
                  />
                </StripeProvider>
              </>
            ) : (
              <button
                type="button"
                onClick={handleContinueToPayment}
                disabled={submitting}
                style={{
                  width: '100%', padding: 18, borderRadius: 8,
                  background: submitting ? 'rgba(232,184,75,0.5)' : '#E8B84B',
                  color: '#3A3530',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Creating order…' : `Continue to Payment — $${total.toFixed(2)}`}
              </button>
            )}
          </div>

          {/* What happens next */}
          {hasDigital && (
            <div style={{
              marginTop: 28, padding: 18,
              background: '#FDF6E3', borderRadius: 8, border: '1px solid rgba(232,184,75,0.2)',
            }}>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>
                What happens after payment
              </div>
              {[
                'Payment is confirmed by Stripe — usually within 5 seconds.',
                'Download links are emailed to you and shown on the next screen.',
                'All purchases stay available in your Downloads library for lifetime re-download.',
                'Direct email links stay valid for 7 days; regenerate anytime from your dashboard.',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, fontSize: 12, color: '#3A3530', lineHeight: 1.5 }}>
                  <span style={{
                    width: 20, height: 20, background: '#E8B84B', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600, flexShrink: 0,
                  }}>{i + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 24 }}>
            {[
              '🔒 SSL Encrypted',
              hasPhysical ? '↩️ 30-Day Returns' : '♾️ Lifetime Access',
              '💬 24h Support',
            ].map((t) => (
              <span key={t} style={{ fontSize: 11, color: '#8A8278' }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Summary sidebar */}
        <OrderSummary
          items={items}
          subtotal={subtotal}
          shipping={shippingCost}
          tax={taxAmount}
          discount={discount}
          total={total}
          promoApplied={promoApplied?.code}
          onApplyPromo={async (code) => { setPromoCode(code); setTimeout(() => applyPromo(), 0); }}
        />
      </div>
    </>
  );
}

// ─── Confirmation screen ───────────────────────────────────────────────────

function ConfirmationScreen({ order }: { order: OrderResponse }) {
  const digitalItems = order.items.filter((i) => i.product.type === 'DIGITAL');
  const physicalItems = order.items.filter((i) => i.product.type === 'PHYSICAL');
  const isPaid = order.status === 'PAID';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px 100px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <span style={{ fontSize: 56, display: 'block', marginBottom: 16 }}>
          {isPaid ? '✓' : '⏳'}
        </span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          {isPaid ? 'Order Confirmed!' : 'Order Received'}
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278', maxWidth: 460, margin: '0 auto' }}>
          Order #{order.id.slice(-8).toUpperCase()} —{' '}
          {isPaid
            ? 'A confirmation email has been sent with your order summary.'
            : 'We\'re finalising your payment. You\'ll receive an email as soon as it\'s confirmed.'}
        </p>
      </div>

      {/* Digital downloads — inline CTAs */}
      {digitalItems.length > 0 && (
        <div style={{
          background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.25)',
          borderRadius: 12, padding: '24px 28px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 14, fontWeight: 600 }}>
            ⚡ Your Digital Downloads
          </div>
          {digitalItems.map((item) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(232,184,75,0.12)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{item.product.name}</div>
                {item.quantity > 1 && (
                  <div style={{ fontSize: 11, color: '#8A8278' }}>Qty: {item.quantity}</div>
                )}
              </div>
              {item.downloadUrl ? (
                <a
                  href={item.downloadUrl}
                  style={{
                    padding: '10px 20px', background: '#3A3530', color: '#E8B84B',
                    borderRadius: 8, textDecoration: 'none',
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}
                >
                  Download
                </a>
              ) : (
                <span style={{ fontSize: 11, color: '#8A8278', fontStyle: 'italic' }}>
                  Link generating…
                </span>
              )}
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#8A8278', marginTop: 14, textAlign: 'center' }}>
            Links stay valid for 7 days — or regenerate anytime from{' '}
            <Link href="/downloads" style={{ color: '#E8B84B', textDecoration: 'none' }}>your Downloads library</Link>.
          </div>
        </div>
      )}

      {/* Physical shipping note */}
      {physicalItems.length > 0 && (
        <div style={{
          background: '#fff', border: '1px solid rgba(232,184,75,0.15)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 8 }}>
            📦 Shipping
          </div>
          <div style={{ fontSize: 13, color: '#3A3530', lineHeight: 1.6 }}>
            {physicalItems.length === 1
              ? `${physicalItems[0].product.name}`
              : `${physicalItems.length} physical items`} will ship to the address you provided.
            You&apos;ll receive a tracking email once your order is dispatched.
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/seeker/dashboard" style={ctaStyle}>View My Orders</Link>
        <Link href="/shop" style={{ ...ctaStyle, background: 'transparent', color: '#3A3530', border: '1.5px solid #E8B84B' }}>
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

// ─── Poll helper ───────────────────────────────────────────────────────────

async function pollOrderPaid(orderId: string, maxAttempts: number): Promise<OrderResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      if (data.status === 'PAID' || data.status === 'DELIVERED') {
        // PAID reached. If this order has digital items, confirm their download
        // URLs have landed too — the post-PAID hook that generates them runs
        // fire-and-forget, so a tight poll after confirm-payment may beat it.
        const digitalItems = (data.items || []).filter((it: any) => it.product?.type === 'DIGITAL');
        const allDigitalReady = digitalItems.length === 0
          || digitalItems.every((it: any) => !!it.downloadUrl);
        if (allDigitalReady || i === maxAttempts - 1) return data;
      }
    } catch { /* fall through to retry */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  const { data } = await api.get(`/orders/${orderId}`);
  return data;
}

// ─── Small UI helpers ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: '#8A8278', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = 'text', full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278' }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        style={{
          padding: '12px 14px', borderRadius: 6,
          border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7',
          fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif",
        }}
      />
    </div>
  );
}

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 32px',
  borderRadius: 8,
  background: '#E8B84B',
  color: '#3A3530',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textDecoration: 'none',
};
