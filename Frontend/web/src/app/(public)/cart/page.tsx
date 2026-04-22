'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart.store';

const typeBadge = (type: string) => {
  const map: Record<string, { label: string; bg: string }> = {
    DIGITAL: { label: 'Digital', bg: 'rgba(232,184,75,0.15)' },
    EVENT_TICKET: { label: 'Event', bg: 'rgba(90,138,106,0.12)' },
    SOUL_TOUR: { label: 'Tour', bg: 'rgba(240,120,32,0.1)' },
  };
  const b = map[type];
  if (!b) return null;
  return <span style={{ padding: '2px 8px', borderRadius: 10, background: b.bg, fontSize: 10, fontWeight: 600, color: '#3A3530' }}>{b.label}</span>;
};

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const warnings = useCartStore((s) => s.warnings);
  const warningsAcknowledged = useCartStore((s) => s.warningsAcknowledged);
  const syncFromServer = useCartStore((s) => s.syncFromServer);
  const acknowledgeWarnings = useCartStore((s) => s.acknowledgeWarnings);
  const { updateQuantity, removeItem, getSubtotal, getItemCount } = useCartStore();
  const subtotal = getSubtotal();
  const itemCount = getItemCount();
  const hasPhysical = items.some(i => i.productType === 'PHYSICAL');
  const hasDigital = items.some(i => i.productType === 'DIGITAL');
  const hasEvents = items.some(i => i.itemType === 'EVENT_TICKET');

  // Refresh from server on mount so stale items, price changes, etc. are
  // surfaced the moment the seeker lands on /cart — even if the navbar already
  // primed a sync earlier. Cheap: single GET.
  useEffect(() => { syncFromServer(); }, [syncFromServer]);

  // Toast "removed" warnings once each — store them in a ref so re-renders
  // don't spam the same message. Blocking warnings (price + overstock) stay
  // in the banner until the user acknowledges.
  const toastedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const w of warnings) {
      if (w.kind === 'removed' && !toastedRef.current.has(w.message)) {
        toast.info(w.message);
        toastedRef.current.add(w.message);
      }
    }
  }, [warnings]);

  const blockingWarnings = warnings.filter((w) => w.kind !== 'removed');
  const mustAcknowledge = blockingWarnings.length > 0 && !warningsAcknowledged;

  // Determine checkout route.
  // Products (digital, physical, or mixed) all flow through the unified /checkout.
  // Events keep their own flow because of the attendee-details step + QR generation.
  const getCheckoutRoute = () => {
    const itemTypes = new Set(items.map(i => i.itemType));
    if (itemTypes.size === 1 && itemTypes.has('EVENT_TICKET')) return '/checkout/event';
    return '/checkout';
  };

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '100px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 64, display: 'block', marginBottom: 24 }}>🛍️</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          Your cart is empty
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>
          Discover curated spiritual tools, digital resources, and experiences from verified practitioners.
        </p>
        <Link href="/shop" style={{
          display: 'inline-block', padding: '14px 32px', borderRadius: 8,
          background: '#E8B84B', color: '#3A3530',
          fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          textDecoration: 'none',
        }}>
          Browse the Shop
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 48px 80px' }}>
      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 32, fontWeight: 400, color: '#3A3530', marginBottom: 6,
      }}>
        Your Cart
      </h1>
      <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 32 }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</p>

      {/* Warnings banner — pricing changes + stock issues. Blocks checkout until acknowledged. */}
      {blockingWarnings.length > 0 && (
        <div style={{
          background: '#FDF6E3',
          border: '1.5px solid #E8B84B',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 28,
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
        }}>
          <div style={{ fontSize: 20, lineHeight: 1 }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 17, color: '#3A3530', marginBottom: 8, fontWeight: 500,
            }}>
              Some items in your cart changed while you were away
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#3A3530', lineHeight: 1.7 }}>
              {blockingWarnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
            {!warningsAcknowledged && (
              <button
                onClick={() => acknowledgeWarnings()}
                style={{
                  marginTop: 12,
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: '#3A3530',
                  color: '#E8B84B',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Acknowledge &amp; continue
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48 }}>
        {/* Left: Cart items */}
        <div>
          {/* Group by type */}
          {[
            { label: 'Physical Items', filter: (i: typeof items[0]) => i.productType === 'PHYSICAL', note: 'Ships within 3-5 business days' },
            { label: 'Digital Products', filter: (i: typeof items[0]) => i.productType === 'DIGITAL', note: 'Instant delivery after purchase' },
            { label: 'Event Tickets', filter: (i: typeof items[0]) => i.itemType === 'EVENT_TICKET', note: 'E-tickets sent to your email' },
            { label: 'Soul Tours', filter: (i: typeof items[0]) => i.itemType === 'SOUL_TOUR', note: 'Confirmation sent within 24 hours' },
          ].map((section) => {
            const sectionItems = items.filter(section.filter);
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.label} style={{ marginBottom: 32 }}>
                <div style={{
                  background: '#3A3530', color: '#E8B84B', padding: '10px 18px', borderRadius: '8px 8px 0 0',
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{section.label} ({sectionItems.length})</span>
                  <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>{section.note}</span>
                </div>
                <div style={{ border: '1px solid rgba(232,184,75,0.1)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                  {sectionItems.map((item, i) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
                      borderBottom: i < sectionItems.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                    }}>
                      <div style={{
                        width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                        background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 28 }}>{item.productType === 'DIGITAL' ? '🎵' : item.itemType === 'EVENT_TICKET' ? '🎫' : '📦'}</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{item.name}</span>
                          {typeBadge(item.productType === 'DIGITAL' ? 'DIGITAL' : item.itemType)}
                        </div>
                        {item.variantName && <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 2 }}>Size: {item.variantName}</div>}
                        {item.guideName && <div style={{ fontSize: 11, color: '#8A8278' }}>by {item.guideName}</div>}
                      </div>
                      {/* Qty controls */}
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(232,184,75,0.2)', borderRadius: 6 }}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{ padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3A3530' }}>−</button>
                        <span style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, minWidth: 30, textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3A3530' }}>+</button>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#3A3530', minWidth: 70, textAlign: 'right' }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                      <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#8A8278', padding: 4 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Summary */}
        <div>
          <div style={{ background: '#fff', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12, position: 'sticky', top: 100, padding: 24 }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530', marginBottom: 20 }}>
              Order Summary
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#8A8278' }}>
              <span>Subtotal ({itemCount} items)</span><span>${subtotal.toFixed(2)}</span>
            </div>
            {hasPhysical && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#8A8278' }}>
                <span>Shipping</span><span>Calculated at checkout</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', paddingTop: 16, marginTop: 8,
              borderTop: '2px solid #E8B84B',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#3A3530' }}>Estimated Total</span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#3A3530' }}>
                ${subtotal.toFixed(2)}
              </span>
            </div>

            {mustAcknowledge ? (
              <div
                title="Please review and acknowledge the warnings above first"
                style={{
                  display: 'block', width: '100%', padding: 16, borderRadius: 8, marginTop: 20,
                  background: 'rgba(58,53,48,0.35)', color: 'rgba(232,184,75,0.7)', textAlign: 'center',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'not-allowed',
                }}
              >
                Review changes above to continue
              </div>
            ) : (
              <Link href={getCheckoutRoute()} style={{
                display: 'block', width: '100%', padding: 16, borderRadius: 8, marginTop: 20,
                background: '#3A3530', color: '#E8B84B', textAlign: 'center',
                fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                textDecoration: 'none',
              }}>
                Proceed to Checkout
              </Link>
            )}
            <Link href="/shop" style={{
              display: 'block', width: '100%', padding: 14, borderRadius: 8, marginTop: 10,
              border: '1.5px solid rgba(232,184,75,0.3)', color: '#3A3530', textAlign: 'center',
              fontSize: 12, fontWeight: 500, letterSpacing: '0.06em',
              textDecoration: 'none',
            }}>
              Continue Shopping
            </Link>

            {/* Notes */}
            {hasDigital && (
              <div style={{ background: '#FDF6E3', borderRadius: 6, padding: '10px 14px', marginTop: 14, fontSize: 11, color: '#3A3530', display: 'flex', gap: 8 }}>
                <span>⚡</span> Digital items will be available for instant download after purchase.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
