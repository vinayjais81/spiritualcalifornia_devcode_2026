'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding.store';
import { api } from '@/lib/api';

const lbl: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.12em',
  textTransform: 'uppercase' as const, color: '#8A8278',
  fontWeight: 500, fontFamily: 'var(--font-inter), sans-serif',
  display: 'block', marginBottom: '6px',
};


function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '32px 0 24px' }}>
      <div style={{ flex: 1, height: '1px', background: 'rgba(232,184,75,0.2)' }} />
      <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8A8278', whiteSpace: 'nowrap', fontFamily: 'var(--font-inter), sans-serif' }}>{label}</div>
      <div style={{ flex: 1, height: '1px', background: 'rgba(232,184,75,0.2)' }} />
    </div>
  );
}

function PricingRow({ label, priceKey, typeKey }: { label: string; priceKey: keyof import('@/types/onboarding').SessionPricing; typeKey?: keyof import('@/types/onboarding').SessionPricing }) {
  const { step5, setStep5 } = useOnboardingStore();
  const pricing = step5.pricing;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
      <label style={{ ...lbl, minWidth: '180px', marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontSize: '13px', color: '#3A3530', fontWeight: 400 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(138,130,120,0.25)', borderRadius: '8px', overflow: 'hidden', background: '#FFFFFF', flexShrink: 0 }}>
        <span style={{ padding: '10px 14px', background: '#FDF6E3', fontSize: '14px', color: '#8A8278', borderRight: '1px solid rgba(138,130,120,0.15)' }}>$</span>
        <input
          type="number"
          placeholder="0"
          min={0}
          value={pricing[priceKey] as string}
          onChange={(e) => setStep5({ pricing: { ...pricing, [priceKey]: e.target.value } })}
          style={{ border: 'none', outline: 'none', padding: '10px 14px', fontSize: '14px', color: '#3A3530', width: '100px', fontFamily: 'var(--font-inter), sans-serif' }}
        />
      </div>
      {typeKey && (
        <select
          value={pricing[typeKey] as string}
          onChange={(e) => setStep5({ pricing: { ...pricing, [typeKey]: e.target.value } })}
          style={{ border: '1px solid rgba(138,130,120,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#3A3530', outline: 'none', background: '#FFFFFF', fontFamily: 'var(--font-inter), sans-serif' }}
        >
          <option>Online</option>
          <option>In-person</option>
          <option>Both</option>
        </select>
      )}
    </div>
  );
}

export function Step5Calendar() {
  const { step5, setStep5, setLoading, isLoading, setError, error, nextStep, prevStep } = useOnboardingStore();
  const searchParams = useSearchParams();
  const [calendlyConnected, setCalendlyConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Detect return from Calendly OAuth
  useEffect(() => {
    const param = searchParams.get('calendly');
    if (param === 'connected') {
      setCalendlyConnected(true);
      setStep5({ calendarType: 'Calendly' });
      // Clean the query param from URL without remounting
      const url = new URL(window.location.href);
      url.searchParams.delete('calendly');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, setStep5]);

  const handleConnectCalendly = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { data } = await api.get('/auth/calendly/auth-url');
      window.location.href = data.url;
    } catch {
      setError('Could not initiate Calendly connection. Please try again.');
      setConnecting(false);
    }
  };

  const handleContinue = async () => {
    setLoading(true); setError(null);
    try {
      await api.put('/guides/onboarding/calendar', {
        calendarType: 'Calendly',
        sessionPricingJson: JSON.stringify(step5.pricing),
      });
      nextStep();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to save calendar settings.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: '44px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: '10px', fontFamily: 'var(--font-inter), sans-serif' }}>Step 5 of 6</div>
        <h1 className="font-cormorant" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, lineHeight: 1.1, color: '#3A3530', marginBottom: '10px' }}>
          Calendar &amp; <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>pricing</em>
        </h1>
        <p style={{ fontSize: '14px', color: '#8A8278', lineHeight: 1.7, maxWidth: '560px', fontFamily: 'var(--font-inter), sans-serif', margin: 0 }}>
          Connect your Calendly account so seekers can book sessions directly. Set your rates — you keep 80–88% of every transaction.
        </p>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#DC2626', fontFamily: 'var(--font-inter), sans-serif', marginBottom: '20px' }}>{error}</div>}

      <SectionDivider label="Calendar Integration" />

      {/* Calendly connect card */}
      <div style={{ border: calendlyConnected ? '1.5px solid #86EFAC' : '1.5px solid rgba(232,184,75,0.3)', borderRadius: '14px', padding: '28px', background: calendlyConnected ? '#F0FDF4' : '#FFFFFF', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
        <div style={{ fontSize: '40px', flexShrink: 0 }}>📅</div>
        <div style={{ flex: 1 }}>
          <div className="font-cormorant" style={{ fontSize: '22px', fontWeight: 400, color: '#3A3530', marginBottom: '6px' }}>Calendly</div>
          <p style={{ fontSize: '13px', color: '#8A8278', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif', marginBottom: '16px', margin: '0 0 16px' }}>
            The industry standard for booking sessions. Seekers see your real-time availability and book instantly — no back-and-forth.
          </p>

          {calendlyConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#DCFCE7', border: '1px solid #86EFAC', fontSize: '13px', color: '#166534', fontFamily: 'var(--font-inter), sans-serif' }}>
                ✓ Calendly connected successfully
              </div>
              <button
                type="button"
                onClick={handleConnectCalendly}
                disabled={connecting}
                style={{ fontSize: '12px', color: '#8A8278', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-inter), sans-serif' }}
              >
                Reconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectCalendly}
              disabled={connecting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 24px', borderRadius: '8px', background: connecting ? '#C4BDB5' : '#00A2FF', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: connecting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}
            >
              {connecting ? 'Redirecting…' : '🔗 Connect with Calendly'}
            </button>
          )}
        </div>
      </div>

      <SectionDivider label="Session Types & Pricing" />

      <PricingRow label="1:1 Session (60 min)" priceKey="session60Price" typeKey="session60Type" />
      <PricingRow label="1:1 Session (90 min)" priceKey="session90Price" typeKey="session90Type" />
      <PricingRow label="Package (4 sessions)" priceKey="packagePrice" />
      <PricingRow label="Group Session (per person)" priceKey="groupPrice" />

      <p style={{ fontSize: '12px', color: '#8A8278', marginTop: '8px', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif' }}>
        Spiritual California retains a platform fee of 12–20% per transaction. You can update your pricing anytime from your dashboard.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(232,184,75,0.15)' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button type="button" onClick={prevStep} style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}>← Back</button>
          <button type="button" onClick={() => nextStep()} style={{ fontSize: '12px', color: '#8A8278', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-inter), sans-serif' }}>Skip for now</button>
        </div>
        <button type="button" onClick={handleContinue} disabled={isLoading} style={{ padding: '14px 36px', borderRadius: '8px', background: isLoading ? '#C4BDB5' : '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}>
          {isLoading ? 'Saving…' : 'Continue → Products & Events'}
        </button>
      </div>
    </div>
  );
}
