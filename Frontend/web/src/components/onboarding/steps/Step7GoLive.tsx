'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { api } from '@/lib/api';

export function Step7GoLive() {

  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const submit = async () => {
      try {
        const res = await api.post('/guides/onboarding/submit');
        if (!cancelled) {
          setSlug(res.data?.slug ?? '');
          setSubmitted(true);
        }
      } catch (err: any) {
        if (!cancelled) {
          // 409 = already submitted — show a "under review" confirmation, not an error
          if (err.response?.status === 409) {
            setAlreadySubmitted(true);
            return;
          }
          const msg = err.response?.data?.message ?? 'Submission failed. Please try again.';
          setError(Array.isArray(msg) ? msg.join(', ') : msg);
        }
      }
    };
    submit();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (alreadySubmitted) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
        <h1 className="font-cormorant" style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 300, color: '#3A3530', marginBottom: '14px', lineHeight: 1.1 }}>
          Already <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>under review</em>
        </h1>
        <p style={{ fontSize: '14px', color: '#8A8278', lineHeight: 1.8, maxWidth: '480px', margin: '0 auto 36px', fontFamily: 'var(--font-inter), sans-serif' }}>
          Your profile has already been submitted and is currently under review by our team. You will receive an email once it has been approved. There is nothing more you need to do right now.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/guide/dashboard" style={{ padding: '14px 32px', borderRadius: '8px', background: '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'var(--font-inter), sans-serif' }}>
            Go to Dashboard →
          </Link>
          <Link href="/" style={{ padding: '14px 32px', borderRadius: '8px', background: 'transparent', color: '#3A3530', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: '1.5px solid rgba(58,53,48,0.3)', textDecoration: 'none', fontFamily: 'var(--font-inter), sans-serif' }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>😔</div>
        <h2 className="font-cormorant" style={{ fontSize: '32px', fontWeight: 300, color: '#3A3530', marginBottom: '12px' }}>Something went wrong</h2>
        <p style={{ fontSize: '14px', color: '#8A8278', lineHeight: 1.7, fontFamily: 'var(--font-inter), sans-serif', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={() => { setError(null); window.location.reload(); }}
          style={{ padding: '14px 32px', borderRadius: '8px', background: '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px', animation: 'spin 2s linear infinite' }}>🌸</div>
        <p style={{ fontSize: '14px', color: '#8A8278', fontFamily: 'var(--font-inter), sans-serif' }}>Publishing your profile…</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '64px', marginBottom: '20px' }}>🌸</div>
      <h1 className="font-cormorant" style={{ fontSize: 'clamp(36px, 6vw, 52px)', fontWeight: 300, color: '#3A3530', marginBottom: '14px', lineHeight: 1.1 }}>
        You are <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>live</em>.
      </h1>
      <p style={{ fontSize: '15px', color: '#8A8278', lineHeight: 1.8, maxWidth: '480px', margin: '0 auto 36px', fontFamily: 'var(--font-inter), sans-serif' }}>
        Welcome to the Spiritual California community. Your profile is now visible to seekers across California and beyond. Check your email to verify your address and unlock full dashboard access.
      </p>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {slug ? (
          <Link href={`/guides/${slug}`} style={{ padding: '14px 32px', borderRadius: '8px', background: '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}>
            View My Profile →
          </Link>
        ) : (
          <Link href="/guide/dashboard" style={{ padding: '14px 32px', borderRadius: '8px', background: '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}>
            Go to Dashboard →
          </Link>
        )}
        <Link href="/" style={{ padding: '14px 32px', borderRadius: '8px', background: 'transparent', color: '#3A3530', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: '1.5px solid rgba(58,53,48,0.3)', textDecoration: 'none', fontFamily: 'var(--font-inter), sans-serif', transition: 'all 0.3s' }}>
          Back to Home
        </Link>
      </div>
      <p style={{ fontSize: '12px', color: '#8A8278', marginTop: '28px', lineHeight: 1.7, fontFamily: 'var(--font-inter), sans-serif' }}>
        <strong>Next steps:</strong> Complete your identity verification to earn the ✦ Verified badge · Upload your certificates to verify individual modalities · Add more products and events from your dashboard.
      </p>
    </div>
  );
}
