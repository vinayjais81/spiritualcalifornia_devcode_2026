'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';

const G = {
  gold:     '#E8B84B',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
  white:    '#FFFFFF',
};

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: G.offWhite, display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 48px',
        borderBottom: '1px solid rgba(232,184,75,0.15)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Image src="/images/logo.jpg" alt="Spiritual California" width={36} height={36}
            style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <div className="font-cormorant" style={{ fontSize: 18, fontWeight: 500, color: G.charcoal, lineHeight: 1.1 }}>
              Spiritual California
            </div>
            <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 10, letterSpacing: '0.15em', color: G.warmGray, textTransform: 'uppercase' }}>
              mind · body · soul
            </div>
          </div>
        </Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(232,184,75,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 28 }}>
                ✉️
              </div>
              <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: G.gold, marginBottom: 10 }}>Check Your Inbox</p>
              <h1 className="font-cormorant" style={{ fontSize: 40, fontWeight: 300, color: G.charcoal, margin: '0 0 16px' }}>
                Reset link sent
              </h1>
              <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.warmGray, lineHeight: 1.7, marginBottom: 32 }}>
                If an account exists for <strong style={{ color: G.charcoal }}>{email}</strong>, you'll receive a password reset link within a few minutes.
              </p>
              <Link href="/signin" style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, color: G.gold, textDecoration: 'none', letterSpacing: '0.05em' }}>
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 40 }}>
                <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 10 }}>
                  Account Recovery
                </p>
                <h1 className="font-cormorant" style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 300, color: G.charcoal, margin: '0 0 10px', lineHeight: 1.1 }}>
                  Forgot your{' '}
                  <em style={{ fontStyle: 'italic', color: G.gold }}>password?</em>
                </h1>
                <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.warmGray, lineHeight: 1.7, margin: 0 }}>
                  Enter your email address and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: '#DC2626' }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: G.warmGray, fontWeight: 500 }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="maya@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    style={{
                      background: G.white, border: `1px solid rgba(232,184,75,0.3)`,
                      borderRadius: 4, padding: '12px 16px',
                      fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.charcoal,
                      outline: 'none', width: '100%', boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginTop: 8, paddingTop: 28, borderTop: '1px solid rgba(232,184,75,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Link href="/signin" style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.warmGray, textDecoration: 'none' }}>
                    ← Back
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '14px 36px',
                      fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, fontWeight: 500,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      borderRadius: 4, border: 'none',
                      background: loading ? '#B5AFA8' : G.charcoal,
                      color: G.white,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {loading && (
                      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    )}
                    {loading ? 'Sending…' : 'Send Reset Link'}
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
