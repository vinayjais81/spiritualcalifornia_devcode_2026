'use client';

import { useState } from 'react';

export function PromoBanner() {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText('WELCOME40');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2C2420 0%, #3A3530 100%)',
      borderRadius: 16, padding: '40px 48px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 60,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 8 }}>
          ✦ Limited Time Offer
        </div>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 36, fontWeight: 400, color: '#fff', lineHeight: 1.2, marginBottom: 8,
        }}>
          40% Off Your First Order
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 420 }}>
          Start your spiritual journey with curated tools, crystals, and digital resources from verified practitioners.
        </p>
      </div>
      <div style={{ flexShrink: 0, marginLeft: 40, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 42, fontWeight: 600, color: '#E8B84B', letterSpacing: '0.08em', marginBottom: 8,
        }}>
          WELCOME40
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
          Use code at checkout
        </div>
        <button
          onClick={copyCode}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 28px', borderRadius: 8,
            background: '#E8B84B', color: '#3A3530',
            fontFamily: "'Inter', sans-serif",
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            border: 'none', cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
      </div>
    </div>
  );
}
