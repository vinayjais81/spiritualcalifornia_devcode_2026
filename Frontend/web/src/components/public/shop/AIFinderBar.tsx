'use client';

import { useState } from 'react';

const suggestions = [
  'I feel anxious and need to calm down',
  'I want to start a meditation practice',
  'I need a gift for someone spiritual',
  'I want to improve my sleep',
  'I am interested in energy healing',
  'I want to create a sacred space at home',
];

const suggestionLabels = [
  'I feel anxious',
  'Starting meditation',
  'Spiritual gift',
  'Better sleep',
  'Energy healing',
  'Sacred home space',
];

export function AIFinderBar() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<{ text: string; products: { name: string; price: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const askAI = async (q?: string) => {
    const input = q || query;
    if (!input.trim()) return;
    setLoading(true);
    // [STUB] In production, call /ai/product-finder
    setTimeout(() => {
      setResponse({
        text: `Based on your interest in "${input}", I'd recommend exploring these items from our collection. Each has been curated by our verified practitioners.`,
        products: [
          { name: '432 Hz Deep Sleep Meditation', price: '$24' },
          { name: 'Amethyst Cluster — Large', price: '$89' },
          { name: 'Lavender Sage Bundle', price: '$18' },
        ],
      });
      setLoading(false);
    }, 800);
  };

  const fillAndAsk = (text: string) => {
    setQuery(text);
    askAI(text);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2C2420 0%, #3A3530 100%)',
      padding: '36px 48px',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase' as const,
          color: '#E8B84B', marginBottom: 10,
        }}>
          ✦ AI Shopping Guide
        </div>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 28, fontWeight: 400, color: '#fff', marginBottom: 6,
        }}>
          What are you looking for today?
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
          Describe your intention, a feeling, or what you need — our guide will find the right tools for your path.
        </p>

        {/* Input */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.07)',
          border: '1.5px solid rgba(232,184,75,0.35)', borderRadius: 12,
          overflow: 'hidden', maxWidth: 680, margin: '0 auto 16px',
        }}>
          <span style={{ padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 20, color: '#E8B84B' }}>
            ✨
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askAI()}
            placeholder='e.g. "something to help me sleep" or "a gift for someone starting meditation"'
            style={{
              flex: 1, padding: '16px 8px', background: 'none', border: 'none', outline: 'none',
              fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#fff',
            }}
          />
          <button
            onClick={() => askAI()}
            disabled={loading}
            style={{
              padding: '0 24px', background: '#E8B84B', color: '#3A3530',
              fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {loading ? '...' : 'Find →'}
          </button>
        </div>

        {/* Suggestion pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, justifyContent: 'center', gap: 8 }}>
          {suggestionLabels.map((label, i) => (
            <button
              key={i}
              onClick={() => fillAndAsk(suggestions[i])}
              style={{
                padding: '7px 16px', borderRadius: 20,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(232,184,75,0.25)',
                fontSize: 12, color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* AI Response */}
        {response && (
          <div style={{
            maxWidth: 680, margin: '16px auto 0',
            background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.3)',
            borderRadius: 10, padding: '16px 20px', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#E8B84B' }}>
                Guide&apos;s Recommendation
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.65 }}>
              {response.text}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' as const }}>
              {response.products.map((p, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(232,184,75,0.2)',
                    borderRadius: 8, padding: '10px 14px', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 500, color: '#fff', marginBottom: 2 }}>{p.name}</div>
                  <div style={{ color: '#E8B84B' }}>{p.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
