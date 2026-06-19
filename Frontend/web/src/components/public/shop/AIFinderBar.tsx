'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AINonAdviceFooter } from '@/components/public/ai/AINonAdviceFooter';
import { CrisisResourcesCard } from '@/components/public/ai/CrisisResourcesCard';

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

interface RecommendedProduct {
  id: string;
  name: string;
  price: string;
}

export function AIFinderBar() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<{
    text: string;
    products: RecommendedProduct[];
    crisis: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Calls POST /ai/product-finder which uses Claude to pick 2-3 matches
  // from the active product catalog based on the user's natural-language
  // query. Response shape: { reply: string, products: [...], crisis?: true }.
  // When `crisis: true` the backend has already suppressed product
  // recommendations and returned a safety-referral reply — the UI swaps
  // the usual response panel for <CrisisResourcesCard>.
  const askAI = async (q?: string) => {
    const input = q || query;
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/ai/product-finder', { query: input });
      const data = res.data ?? {};
      setResponse({
        text: data.reply ?? '',
        crisis: data.crisis === true,
        products: (data.products ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: typeof p.price === 'number' ? `$${p.price.toFixed(0)}` : `$${p.price}`,
        })),
      });
    } catch {
      // Backend already returns a graceful fallback on Claude failures; this
      // only fires on network/server errors.
      setResponse({
        text: 'Sorry, I had trouble fetching recommendations. Browse the shop directly below.',
        crisis: false,
        products: [],
      });
    } finally {
      setLoading(false);
    }
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
          color: '#F07814', marginBottom: 10,
        }}>
          ✦ AI Shopping Guide
        </div>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
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
          border: '1.5px solid rgba(240,120,20,0.35)', borderRadius: 12,
          overflow: 'hidden', maxWidth: 680, margin: '0 auto 16px',
        }}>
          <span style={{ padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 20, color: '#F07814' }}>
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
              padding: '0 24px', background: '#F07814', color: '#3A3530',
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
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(240,120,20,0.25)',
                fontSize: 12, color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* AI Response — crisis branch replaces the usual recommendations
            with a safety-resources card. Backend sets `crisis: true`
            when the user message matches the crisis keyword set. */}
        {response && response.crisis && (
          <div style={{ maxWidth: 680, margin: '16px auto 0' }}>
            <CrisisResourcesCard reply={response.text} variant="dark" />
          </div>
        )}

        {response && !response.crisis && (
          <div style={{
            maxWidth: 680, margin: '16px auto 0',
            background: 'rgba(240,120,20,0.1)', border: '1px solid rgba(240,120,20,0.3)',
            borderRadius: 10, padding: '16px 20px', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#F07814' }}>
                Guide&apos;s Recommendation
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.65 }}>
              {response.text}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' as const }}>
              {response.products.map((p) => (
                <Link
                  key={p.id}
                  href={`/shop/${p.id}`}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(240,120,20,0.2)',
                    borderRadius: 8, padding: '10px 14px', fontSize: 12, cursor: 'pointer',
                    textDecoration: 'none', display: 'block',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
                    e.currentTarget.style.borderColor = 'rgba(240,120,20,0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(240,120,20,0.2)';
                  }}
                >
                  <div style={{ fontWeight: 500, color: '#fff', marginBottom: 2 }}>{p.name}</div>
                  <div style={{ color: '#F07814' }}>{p.price}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Compliance: persistent AI non-advice disclaimer. */}
        <AINonAdviceFooter variant="dark" />
      </div>
    </div>
  );
}
