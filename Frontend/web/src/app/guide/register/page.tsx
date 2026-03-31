'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const G = {
  gold:      '#E8B84B',
  goldLight: '#F5D98A',
  goldPale:  '#FDF6E3',
  charcoal:  '#3A3530',
  warmGray:  '#8A8278',
  white:     '#FFFFFF',
  red:       '#C0392B',
};

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

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: G.warmGray,
  fontWeight: 500,
  fontFamily: 'var(--font-inter), sans-serif',
};

export default function GuideRegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await api.post('/auth/register', {
        firstName,
        lastName,
        email,
        password,
      });
      setAuth(authData.user, authData.accessToken);
      // Start guide onboarding record then enter wizard
      await api.post('/guides/onboarding/start');
      router.replace('/onboarding/guide');
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Registration failed. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 48px',
        background: 'rgba(250,250,247,0.95)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(232,184,75,0.15)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Image src="/images/logo.jpg" alt="Spiritual California" width={40} height={40}
            style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 18, fontWeight: 500, color: G.charcoal }}>
              Spiritual California
            </span>
            <span style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.warmGray, marginTop: 2 }}>
              mind · body · soul
            </span>
          </div>
        </Link>
        <Link href="/signin?redirect=/onboarding/guide" style={{
          fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: G.charcoal,
          textDecoration: 'none', borderBottom: `1.5px solid ${G.gold}`, paddingBottom: 2,
        }}>
          Sign In
        </Link>
      </nav>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingTop: 100, paddingBottom: 60,
      }}>
        <div style={{ width: '100%', maxWidth: 520, padding: '0 24px' }}>

          {/* Left-side value prop (eyebrow + title) */}
          <p style={{
            fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: G.gold, marginBottom: 10, fontFamily: 'var(--font-inter), sans-serif',
          }}>
            Become a Guide
          </p>
          <h1 style={{
            fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 42,
            fontWeight: 400, lineHeight: 1.15, color: G.charcoal, marginBottom: 8,
          }}>
            Share your <em style={{ fontStyle: 'italic', color: G.gold }}>practice</em>
          </h1>
          <p style={{
            fontSize: 14, color: G.warmGray, lineHeight: 1.6, marginBottom: 36,
            fontFamily: 'var(--font-inter), sans-serif',
          }}>
            Join a curated community of verified wellness practitioners. Create your free account to begin the guide onboarding process.
          </p>

          {/* Google OAuth */}
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: 13,
              border: `1px solid rgba(138,130,120,0.25)`, borderRadius: 4,
              background: G.white, cursor: 'pointer', fontSize: 13, color: G.charcoal,
              marginBottom: 20, textDecoration: 'none',
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700 }}>G</span> Continue with Google
          </a>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.2)' }} />
            <span style={{ fontSize: 11, color: G.warmGray, letterSpacing: '0.1em', fontFamily: 'var(--font-inter), sans-serif' }}>
              or register with email
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.2)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                padding: '12px 16px', fontSize: 13, color: '#DC2626',
                fontFamily: 'var(--font-inter), sans-serif',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>First Name</label>
                <input style={inputStyle} type="text" placeholder="Maya" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Last Name</label>
                <input style={inputStyle} type="text" placeholder="Rosenberg" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Email Address</label>
              <input style={inputStyle} type="email" placeholder="maya@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 60 }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: G.warmGray, fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: G.charcoal, color: G.white,
                fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                border: 'none', borderRadius: 4, padding: '16px 36px',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {loading ? 'Creating Account…' : <>Create Account & Continue <span style={{ fontSize: 16 }}>→</span></>}
            </button>
          </form>

          <p style={{
            textAlign: 'center', fontSize: 13, color: G.warmGray,
            marginTop: 24, fontFamily: 'var(--font-inter), sans-serif',
          }}>
            Already have an account?{' '}
            <Link href="/signin?redirect=/onboarding/guide" style={{ color: G.gold, textDecoration: 'none' }}>
              Sign in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
