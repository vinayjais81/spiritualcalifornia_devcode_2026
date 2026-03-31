'use client';

import { useState } from 'react';

interface PaymentFormProps {
  tabs?: string[];
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  cancellationNote?: string;
}

export function PaymentForm({ tabs = ['Credit / Debit', 'Apple Pay', 'PayPal'], submitLabel, onSubmit, loading, cancellationNote }: PaymentFormProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      {/* Payment Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(232,184,75,0.2)' }}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              flex: 1, padding: '12px 16px',
              background: activeTab === i ? '#3A3530' : '#fff',
              color: activeTab === i ? '#E8B84B' : '#8A8278',
              border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: activeTab === i ? 600 : 400,
              letterSpacing: '0.04em',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Card form (shown for Credit/Debit tab) */}
      {activeTab === 0 && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 6, display: 'block' }}>
              Card Number
            </label>
            <div style={{
              padding: '14px 16px', borderRadius: 6,
              border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7',
              fontSize: 14, color: '#8A8278',
            }}>
              •••• •••• •••• ••••
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 6, display: 'block' }}>
                Expiry
              </label>
              <input placeholder="MM / YY" style={{
                width: '100%', padding: '12px 14px', borderRadius: 6,
                border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7',
                fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif",
              }} />
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 6, display: 'block' }}>
                CVC
              </label>
              <input placeholder="•••" style={{
                width: '100%', padding: '12px 14px', borderRadius: 6,
                border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7',
                fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif",
              }} />
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 6, display: 'block' }}>
              Name on Card
            </label>
            <input placeholder="Full name as shown on card" style={{
              width: '100%', padding: '12px 14px', borderRadius: 6,
              border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7',
              fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif",
            }} />
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div style={{ textAlign: 'center', padding: '32px 0 24px', color: '#8A8278', fontSize: 13 }}>
          Click below to complete payment with Apple Pay
        </div>
      )}

      {activeTab === 2 && (
        <div style={{ textAlign: 'center', padding: '32px 0 24px', color: '#8A8278', fontSize: 13 }}>
          You&apos;ll be redirected to PayPal to complete payment
        </div>
      )}

      {/* Cancellation policy */}
      {cancellationNote && (
        <div style={{
          background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)',
          borderRadius: 8, padding: '14px 18px', marginBottom: 24,
          fontSize: 12, color: '#3A3530', lineHeight: 1.6,
        }}>
          <strong style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cancellation Policy</strong>
          <p style={{ marginTop: 6 }}>{cancellationNote}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={loading}
        style={{
          width: '100%', padding: 18, borderRadius: 8,
          background: '#E8B84B', color: '#3A3530',
          fontFamily: "'Inter', sans-serif",
          fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Processing...' : submitLabel}
      </button>

      {/* Secure note */}
      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#8A8278' }}>
        🔒 Secured by <span style={{ color: '#E8B84B' }}>Stripe</span> · 256-bit SSL encryption
      </div>
    </div>
  );
}
