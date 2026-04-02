'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const G = {
  gold:      '#E8B84B',
  goldLight: '#F5D98A',
  goldPale:  '#FDF6E3',
  charcoal:  '#3A3530',
  warmGray:  '#8A8278',
  offWhite:  '#FAFAF7',
  white:     '#FFFFFF',
  red:       '#C0392B',
};

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    background: G.white,
    border: `1px solid rgba(232,184,75,0.3)`,
    borderRadius: 4,
    padding: '12px 16px',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: 14,
    color: G.charcoal,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.accessToken);
      const roles: string[] = data.user.roles ?? [];
      const isAdmin = roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN');
      const isGuide = roles.some((r) => r === 'GUIDE');
      const isSeeker = roles.some((r) => r === 'SEEKER');
      const redirectTo = searchParams.get('redirect');
      if (isAdmin) {
        router.push('/dashboard');
      } else if (redirectTo) {
        router.push(redirectTo);
      } else if (isGuide) {
        // Wizard fetches its own status and resumes at the right step
        router.push('/onboarding/guide');
      } else if (isSeeker) {
        // Resume incomplete seeker registration if not finished
        try {
          const { data: status } = await api.get('/seekers/onboarding/status');
          if (!status.completed) {
            router.push(`/register?step=${status.step > 1 ? status.step : 2}`);
          } else {
            router.push('/');
          }
        } catch {
          router.push('/');
        }
      } else {
        router.push('/');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Invalid email or password.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: G.offWhite, display: 'flex', flexDirection: 'column' }}>
      {/* Botanical background */}
      <svg
        style={{ position: 'fixed', top: 0, right: 0, width: 320, height: '100vh', pointerEvents: 'none', zIndex: 0, opacity: 0.04 }}
        viewBox="0 0 320 800" fill="none"
      >
        <ellipse cx="260" cy="200" rx="120" ry="180" stroke="#E8B84B" strokeWidth="1.5" transform="rotate(-20 260 200)" />
        <ellipse cx="200" cy="400" rx="90" ry="140" stroke="#E8B84B" strokeWidth="1" transform="rotate(15 200 400)" />
        <line x1="260" y1="380" x2="260" y2="800" stroke="#E8B84B" strokeWidth="1" />
        <ellipse cx="180" cy="600" rx="70" ry="110" stroke="#E8B84B" strokeWidth="1" transform="rotate(-10 180 600)" />
      </svg>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 48px',
        background: 'rgba(250,250,247,0.94)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(232,184,75,0.15)',
        position: 'relative', zIndex: 10,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Image src="/images/logo.jpg" alt="Spiritual California" width={44} height={44}
            style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span className="font-cormorant" style={{ fontSize: 18, fontWeight: 500, color: G.charcoal }}>
              Spiritual California
            </span>
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.warmGray, marginTop: 3 }}>
              mind · body · soul
            </span>
          </div>
        </Link>
        <Link href="/register" style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.warmGray, textDecoration: 'none' }}>
          Create Account
        </Link>
      </nav>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 10 }}>
              Welcome Back
            </p>
            <h1 className="font-cormorant" style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 300, color: G.charcoal, margin: '0 0 10px', lineHeight: 1.1 }}>
              Sign in to your{' '}
              <em style={{ fontStyle: 'italic', color: G.gold }}>journey</em>
            </h1>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.warmGray, lineHeight: 1.7, margin: 0 }}>
              Continue exploring guides, events, and healing practices.
            </p>
          </div>

          {/* Google OAuth */}
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
            onClick={() => {
              // Save redirect target so Google OAuth success page can return here
              const redirectTo = searchParams.get('redirect');
              if (redirectTo) {
                try { sessionStorage.setItem('sc-auth-redirect', redirectTo); } catch {}
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: 13,
              border: `1px solid rgba(138,130,120,0.25)`, borderRadius: 4,
              background: G.white, cursor: 'pointer',
              fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.charcoal,
              marginBottom: 12, textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700 }}>G</span> Continue with Google
          </a>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '20px 0 28px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.2)' }} />
            <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, color: G.warmGray, letterSpacing: '0.1em' }}>or sign in with email</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.2)' }} />
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
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: G.warmGray, fontWeight: 500 }}>
                  Password
                </label>
                <Link href="/forgot-password" style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, color: G.gold, textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: G.warmGray, padding: 4 }}
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div style={{ marginTop: 8, paddingTop: 28, borderTop: '1px solid rgba(232,184,75,0.15)' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '15px 36px',
                  fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, fontWeight: 500,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  borderRadius: 4, border: 'none',
                  background: loading ? '#B5AFA8' : G.charcoal,
                  color: G.white,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = G.gold; }}
                onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = G.charcoal; }}
              >
                {loading && (
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                )}
                {loading ? 'Signing In…' : 'Sign In'}
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </button>
            </div>
          </form>

          <p style={{ textAlign: 'center', fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.warmGray, marginTop: 24 }}>
            Don&apos;t have an account?{' '}
            <Link
              href={searchParams.get('redirect') ? `/register?redirect=${encodeURIComponent(searchParams.get('redirect')!)}` : '/register'}
              style={{ color: G.gold, textDecoration: 'none' }}
            >
              Create one free →
            </Link>
          </p>
          <p style={{ textAlign: 'center', fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, color: G.warmGray, marginTop: 12 }}>
            Are you a practitioner?{' '}
            <Link href="/onboarding/guide" style={{ color: G.gold, textDecoration: 'none' }}>List your practice →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>}>
      <SignInContent />
    </Suspense>
  );
}