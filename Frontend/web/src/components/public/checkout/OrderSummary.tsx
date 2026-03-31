'use client';

import { useState } from 'react';
import { CartItem } from '@/store/cart.store';

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  shipping?: number;
  tax?: number;
  discount?: number;
  total: number;
  onApplyPromo?: (code: string) => void;
  promoApplied?: string;
  note?: string;
  children?: React.ReactNode;
}

export function OrderSummary({ items, subtotal, shipping, tax, discount, total, onApplyPromo, promoApplied, note, children }: OrderSummaryProps) {
  const [promoCode, setPromoCode] = useState('');

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(232,184,75,0.15)',
      borderRadius: 12, position: 'sticky', top: 40, overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530' }}>
          Order Summary
        </h3>
      </div>

      {/* Items */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
              background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 22 }}>
                  {item.productType === 'DIGITAL' ? '🎵' : item.itemType === 'EVENT_TICKET' ? '🎫' : '📦'}
                </span>
              )}
              {item.quantity > 1 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 20, height: 20, borderRadius: '50%', background: '#E8B84B', color: '#3A3530',
                  fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.quantity}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </div>
              {item.variantName && <div style={{ fontSize: 11, color: '#8A8278' }}>{item.variantName}</div>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530', flexShrink: 0 }}>
              ${(item.price * item.quantity).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Promo code */}
      {onApplyPromo && !promoApplied && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(232,184,75,0.1)', display: 'flex', gap: 8 }}>
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Promo code"
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 6,
              border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7',
              fontSize: 12, outline: 'none', fontFamily: "'Inter', sans-serif",
            }}
          />
          <button
            onClick={() => promoCode && onApplyPromo(promoCode)}
            style={{
              padding: '9px 16px', borderRadius: 6, background: '#3A3530', color: '#E8B84B',
              fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Totals */}
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8A8278' }}>
          <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
        </div>
        {discount !== undefined && discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#5A8A6A' }}>
            <span>Discount{promoApplied && ` (${promoApplied})`}</span><span>−${discount.toFixed(2)}</span>
          </div>
        )}
        {shipping !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: shipping === 0 ? '#5A8A6A' : '#8A8278' }}>
            <span>Shipping</span><span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
          </div>
        )}
        {tax !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8A8278' }}>
            <span>Tax</span><span>${tax.toFixed(2)}</span>
          </div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4,
          borderTop: '2px solid #E8B84B',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#3A3530' }}>Total</span>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#3A3530' }}>
            ${total.toFixed(2)}
          </span>
        </div>
      </div>

      {note && (
        <div style={{ padding: '12px 24px 16px', fontSize: 11, color: '#8A8278', textAlign: 'center', background: '#FDF6E3' }}>
          {note}
        </div>
      )}

      {children}
    </div>
  );
}
