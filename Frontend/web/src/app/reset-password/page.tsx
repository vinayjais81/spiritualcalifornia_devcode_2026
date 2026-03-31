'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';

type Status = 'idle' | 'loading' | 'success' | 'error';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState<'password' | 'confirm' | null>(null);

  if (!token) {
    return <ErrorLayout message="No reset token found. Please use the link from your email." />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg('');
    setStatus('loading');

    try {
      await api.post('/auth/reset-password', { token, password });
      setStatus('success');
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <PageShell>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'rgba(232,184,75,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17L4 12"
                stroke="#E8B84B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: '#E8B84B',
              marginBottom: '10px',
            }}
          >
            Password Reset
          </div>
          <h1
            className="font-cormorant"
            style={{ fontSize: '40px', fontWeight: 300, color: '#3A3530', margin: '0 0 16px' }}
          >
            Password updated
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '14px',
              color: '#8A8278',
              lineHeight: 1.7,
              marginBottom: '40px',
            }}
          >
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 36px',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              borderRadius: '8px',
              background: '#3A3530',
              color: '#FFFFFF',
              textDecoration: 'none',
            }}
          >
            Return Home
          </Link>
        </div>
      </PageShell>
    );
  }

  const inputStyle = (field: 'password' | 'confirm'): React.CSSProperties => ({
    width: '100%',
    padding: '12px 44px 12px 16px',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: '14px',
    color: '#3A3530',
    background: '#FFFFFF',
    border: `1px solid ${focused === field ? '#E8B84B' : 'rgba(138,130,120,0.25)'}`,
    borderRadius: '8px',
    boxShadow: focused === field ? '0 0 0 3px rgba(232,184,75,0.1)' : 'none',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  });

  return (
    <PageShell>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <div
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#E8B84B',
              marginBottom: '10px',
            }}
          >
            Account Security
          </div>
          <h1
            className="font-cormorant"
            style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 300, color: '#3A3530', margin: '0 0 10px' }}
          >
            Set a new{' '}
            <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>password</em>
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '14px',
              color: '#8A8278',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            Choose a strong password with at least 8 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* New Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#8A8278',
              }}
            >
              New Password <span style={{ color: '#E8B84B' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                style={inputStyle('password')}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#8A8278',
                }}
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

          {/* Confirm Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#8A8278',
              }}
            >
              Confirm Password <span style={{ color: '#E8B84B' }}>*</span>
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
              style={inputStyle('confirm')}
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(192,57,43,0.06)',
                border: '1px solid rgba(192,57,43,0.2)',
                borderRadius: '8px',
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '13px',
                color: '#C0392B',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Submit row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '20px',
              paddingTop: '28px',
              borderTop: '1px solid rgba(232,184,75,0.15)',
            }}
          >
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8A8278',
                textDecoration: 'none',
              }}
            >
              ← Cancel
            </Link>
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '14px 36px',
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                borderRadius: '8px',
                border: 'none',
                background: status === 'loading' ? '#B5AFA8' : '#3A3530',
                color: '#FFFFFF',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'loading' && (
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#FFFFFF',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
              )}
              {status === 'loading' ? 'Saving…' : 'Reset Password'}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex', flexDirection: 'column' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 48px',
          borderBottom: '1px solid rgba(232,184,75,0.15)',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <Image
            src="/images/logo.jpg"
            alt="Spiritual California"
            width={36}
            height={36}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <div
              className="font-cormorant"
              style={{ fontSize: '18px', fontWeight: 500, color: '#3A3530', lineHeight: 1.1 }}
            >
              Spiritual California
            </div>
            <div
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '10px',
                letterSpacing: '0.15em',
                color: '#8A8278',
                textTransform: 'uppercase',
              }}
            >
              mind · body · soul
            </div>
          </div>
        </Link>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        {children}
      </div>
    </div>
  );
}

function ErrorLayout({ message }: { message: string }) {
  return (
    <PageShell>
      <div style={{ textAlign: 'center', maxWidth: '440px' }}>
        <h1
          className="font-cormorant"
          style={{ fontSize: '40px', fontWeight: 300, color: '#3A3530', margin: '0 0 16px' }}
        >
          Invalid link
        </h1>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '14px', color: '#8A8278', lineHeight: 1.7, marginBottom: '32px' }}>
          {message}
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '14px 36px',
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            borderRadius: '8px',
            background: '#3A3530',
            color: '#FFFFFF',
            textDecoration: 'none',
          }}
        >
          Return Home
        </Link>
      </div>
    </PageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
