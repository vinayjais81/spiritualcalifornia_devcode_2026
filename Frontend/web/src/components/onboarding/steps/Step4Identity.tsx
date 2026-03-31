'use client';

import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { api } from '@/lib/api';

export function Step4Identity() {
  const { setStep4, setLoading, isLoading, setError, error, nextStep, prevStep } = useOnboardingStore();
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [verificationStarted, setVerificationStarted] = useState(false);

  const handleStartVerification = async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.post('/verification/identity/start');
      setStep4({ skipped: false, inquiryId: data.inquiryId });

      if (data.verifyUrl) {
        setVerifyUrl(data.verifyUrl);
        setVerificationStarted(true);
        window.open(data.verifyUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Stub mode — no real URL, just advance
        nextStep();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Verification unavailable. You can complete this from your dashboard.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleContinueAfterVerification = () => {
    nextStep();
  };

  const handleSkip = () => {
    setStep4({ skipped: true });
    nextStep();
  };

  return (
    <div>
      <div style={{ marginBottom: '44px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: '10px', fontFamily: 'var(--font-inter), sans-serif' }}>Step 4 of 6</div>
        <h1 className="font-cormorant" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, lineHeight: 1.1, color: '#3A3530', marginBottom: '10px' }}>
          Verify your <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>identity</em>
        </h1>
        <p style={{ fontSize: '14px', color: '#8A8278', lineHeight: 1.7, maxWidth: '560px', fontFamily: 'var(--font-inter), sans-serif', margin: 0 }}>
          Identity verification is powered by Persona — the same trusted technology used by LinkedIn, Airbnb, and leading marketplaces. It takes about 2 minutes.
        </p>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#DC2626', fontFamily: 'var(--font-inter), sans-serif', marginBottom: '20px' }}>{error}</div>}

      {/* Persona block */}
      <div style={{ border: '1.5px solid rgba(232,184,75,0.3)', borderRadius: '14px', padding: '28px', background: '#FFFFFF', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
        <div style={{ fontSize: '48px', flexShrink: 0 }}>🪪</div>
        <div>
          <div className="font-cormorant" style={{ fontSize: '22px', fontWeight: 400, color: '#3A3530', marginBottom: '6px' }}>Verify with Persona</div>
          {verificationStarted ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#F0FDF4', border: '1px solid #86EFAC', marginBottom: '12px', fontSize: '13px', color: '#166534', fontFamily: 'var(--font-inter), sans-serif' }}>
                ✓ Persona verification opened in a new tab. Complete the ID check there, then return here.
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => verifyUrl && window.open(verifyUrl, '_blank', 'noopener,noreferrer')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', background: 'transparent', color: '#3A3530', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1.5px solid #3A3530', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}>
                  Re-open Persona ↗
                </button>
                <button type="button" onClick={handleContinueAfterVerification} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 20px', borderRadius: '8px', background: '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}>
                  I've completed verification →
                </button>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '13px', color: '#8A8278', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif', marginBottom: '14px' }}>
                A quick government ID check + selfie liveness test. Your data is encrypted, never stored on our servers, and handled exclusively by Persona in compliance with CCPA and GDPR.
                <br /><br />
                Once verified, your profile will display the coveted <strong>✦ Verified</strong> badge — making you significantly more discoverable and bookable.
              </p>
              <button
                type="button"
                onClick={handleStartVerification}
                disabled={isLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 24px', borderRadius: '8px', background: isLoading ? '#C4BDB5' : '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}
              >
                🔒 {isLoading ? 'Opening Persona…' : 'Start Verification →'}
              </button>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: '#FDF6E3', border: '1px solid #E8B84B', fontSize: '12px', color: '#3A3530', marginTop: '10px', fontFamily: 'var(--font-inter), sans-serif', marginLeft: '12px' }}>
                ✦ Verified · Spiritual California
              </div>
            </>
          )}
        </div>
      </div>

      {/* Trust box */}
      <div style={{ borderLeft: '3px solid #E8B84B', padding: '16px 20px', background: '#FDF6E3', borderRadius: '0 10px 10px 0', marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: '6px', fontFamily: 'var(--font-inter), sans-serif' }}>✦ Why it increases trust</div>
        <p style={{ fontSize: '13px', color: '#8A8278', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif', margin: 0 }}>Seekers on Spiritual California are sharing vulnerable moments of their lives. A verified badge signals that you are a real, accountable person. Verified practitioners receive <strong>40% more profile views</strong> and <strong>3× more bookings</strong> on average. You can complete this step later from your dashboard.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(232,184,75,0.15)' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button type="button" onClick={prevStep} style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}>← Back</button>
          <button type="button" onClick={handleSkip} style={{ fontSize: '12px', color: '#8A8278', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-inter), sans-serif' }}>Skip for now — verify later</button>
        </div>
        {verificationStarted && (
          <button type="button" onClick={handleContinueAfterVerification} style={{ padding: '14px 36px', borderRadius: '8px', background: '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}>
            Continue → Calendar
          </button>
        )}
      </div>
    </div>
  );
}
