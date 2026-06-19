'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { PasswordStrengthMeter, evaluatePassword } from '@/components/auth/PasswordStrengthMeter';
import { FieldLabel, FormLegend } from '@/components/forms';

type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Pre-launch guide account-claim page. The admin convert-test-account
 * workflow swaps a guide's throwaway email for a real one and sends an
 * invite to `/guide/claim?token=...`. Hitting this page with that token
 * verifies the email and sets a password in one shot — same end-state as
 * /verify-email + /reset-password combined, mapped to a single backend
 * call (`POST /auth/claim-account`).
 *
 * On success the API returns access/refresh tokens (refresh stored in the
 * httpOnly cookie); we drop the user on the guide dashboard.
 */
function ClaimAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const setAuth = useAuthStore((s) => s.setAuth);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState<'password' | 'confirm' | null>(null);

  const pwdStrength = useMemo(() => evaluatePassword(password), [password]);

  if (!token) {
    return (
      <ErrorLayout message="This claim link is missing its token. Please use the link from the email we sent you." />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pwdStrength.allPassed) {
      const firstFailing = pwdStrength.rules.find((r) => !r.passed);
      setErrorMsg(firstFailing ? `Password: ${firstFailing.label}` : 'Password does not meet the requirements.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg('');
    setStatus('loading');

    try {
      const { data } = await api.post('/auth/claim-account', { token, password });
      // Hand off to the auth store so the very next request from this tab
      // is authenticated AND the silent-refresh timer kicks in — same
      // post-login wiring as /signin and /verify-email use.
      if (data?.user && data?.accessToken) {
        setAuth(data.user, data.accessToken);
      }
      setStatus('success');
      // Brief pause so the success state is visible, then route to the
      // guide dashboard where they can finish profile / verification.
      setTimeout(() => router.push('/guide/dashboard'), 1200);
    } catch (err: any) {
      const msg: string =
        err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'rgba(240,120,20,0.1)',
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
                stroke="#F07814"
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
              color: '#F07814',
              marginBottom: '10px',
            }}
          >
            Account Claimed
          </div>
          <h1
            className="font-playfair"
            style={{ fontSize: '40px', fontWeight: 300, color: '#3A3530', margin: '0 0 16px' }}
          >
            Welcome aboard
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '14px',
              color: '#8A8278',
              lineHeight: 1.7,
            }}
          >
            Taking you to your dashboard…
          </p>
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
    border: `1px solid ${focused === field ? '#F07814' : 'rgba(138,130,120,0.25)'}`,
    borderRadius: '8px',
    boxShadow: focused === field ? '0 0 0 3px rgba(240,120,20,0.1)' : 'none',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  });

  return (
    <PageShell>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ marginBottom: '40px' }}>
          <div
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#F07814',
              marginBottom: '10px',
            }}
          >
            Guide Account
          </div>
          <h1
            className="font-playfair"
            style={{
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 300,
              color: '#3A3530',
              margin: '0 0 10px',
            }}
          >
            Claim your{' '}
            <em style={{ fontStyle: 'italic', color: '#F07814' }}>account</em>
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
            Choose a password to finish setting up your guide profile. This is the only step left
            before you can sign in.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <FormLegend />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <FieldLabel
              htmlFor="claim-password-input"
              required
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#8A8278',
              }}
            >
              Password
            </FieldLabel>
            <div style={{ position: 'relative' }}>
              <input
                id="claim-password-input"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 10 characters with mixed case, number, and symbol"
                required
                aria-required="true"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                aria-invalid={password.length > 0 && !pwdStrength.allPassed}
                aria-describedby="claim-password-strength"
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                style={inputStyle('password')}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
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
                    <path
                      d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </button>
            </div>
            <div id="claim-password-strength">
              <PasswordStrengthMeter password={password} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <FieldLabel
              htmlFor="claim-confirm-input"
              required
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#8A8278',
              }}
            >
              Confirm Password
            </FieldLabel>
            <input
              id="claim-confirm-input"
              type={showPass ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
              aria-required="true"
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
              style={inputStyle('confirm')}
            />
          </div>

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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '20px',
              paddingTop: '28px',
              borderTop: '1px solid rgba(240,120,20,0.15)',
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
            {(() => {
              const submitDisabled =
                status === 'loading' ||
                !pwdStrength.allPassed ||
                password !== confirm ||
                confirm.length === 0;
              return (
                <button
                  type="submit"
                  disabled={submitDisabled}
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
                    background: submitDisabled ? '#B5AFA8' : '#3A3530',
                    color: '#FFFFFF',
                    cursor: submitDisabled ? 'not-allowed' : 'pointer',
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
                  {status === 'loading' ? 'Claiming…' : 'Claim Account'}
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </button>
              );
            })()}
          </div>
        </form>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F2EB', display: 'flex', flexDirection: 'column' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 48px',
          borderBottom: '1px solid rgba(240,120,20,0.15)',
        }}
      >
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}
        >
          <Image
            src="/images/logo.jpg"
            alt="Spiritual California"
            width={36}
            height={36}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <div
              className="font-playfair"
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
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
        }}
      >
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
          className="font-playfair"
          style={{ fontSize: '40px', fontWeight: 300, color: '#3A3530', margin: '0 0 16px' }}
        >
          Invalid link
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '14px',
            color: '#8A8278',
            lineHeight: 1.7,
            marginBottom: '32px',
          }}
        >
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

export default function ClaimAccountPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          Loading…
        </div>
      }
    >
      <ClaimAccountContent />
    </Suspense>
  );
}
