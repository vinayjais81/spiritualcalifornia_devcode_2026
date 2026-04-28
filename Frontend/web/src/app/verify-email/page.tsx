'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';

type Status = 'verifying' | 'success' | 'expired' | 'invalid' | 'already_verified';

function VerifyEmailContent() {

  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [countdown, setCountdown] = useState(5);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setStatus('invalid');
      return;
    }

    api
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success');
      })
      .catch((err: any) => {
        const message: string = err?.response?.data?.message ?? '';
        if (message.toLowerCase().includes('expired')) {
          setStatus('expired');
        } else if (message.toLowerCase().includes('already')) {
          setStatus('already_verified');
        } else {
          setStatus('invalid');
        }
      });
  }, [token]);

  // Countdown redirect on success — drop the user on their dashboard so
  // they see the profile-completeness widget (which now hosts the wizard's
  // step 3+ fields) instead of bouncing to the public homepage.
  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) {
      router.push('/seeker/dashboard');
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 48px',
          borderBottom: '1px solid rgba(232,184,75,0.15)',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
          }}
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

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
        }}
      >
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          {status === 'verifying' && <VerifyingState />}
          {status === 'success' && <SuccessState countdown={countdown} />}
          {status === 'expired' && <ExpiredState />}
          {status === 'already_verified' && <AlreadyVerifiedState />}
          {status === 'invalid' && <InvalidState />}
        </div>
      </div>
    </div>
  );
}

function VerifyingState() {
  return (
    <>
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            border: '3px solid rgba(232,184,75,0.2)',
            borderTopColor: '#E8B84B',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 24px',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
      <h1
        className="font-cormorant"
        style={{ fontSize: '36px', fontWeight: 300, color: '#3A3530', marginBottom: '12px' }}
      >
        Verifying your email…
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '14px',
          color: '#8A8278',
          lineHeight: 1.7,
        }}
      >
        Please wait while we confirm your email address.
      </p>
    </>
  );
}

function SuccessState({ countdown }: { countdown: number }) {
  return (
    <>
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'rgba(232,184,75,0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
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
      </div>

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
        Email Verified
      </div>

      <h1
        className="font-cormorant"
        style={{ fontSize: '40px', fontWeight: 300, color: '#3A3530', margin: '0 0 16px' }}
      >
        Welcome to{' '}
        <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>Spiritual California</em>
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
        Your email has been verified. You can now access all features of your account.
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
          textTransform: 'uppercase',
          borderRadius: '8px',
          background: '#3A3530',
          color: '#FFFFFF',
          textDecoration: 'none',
        }}
      >
        Explore Practitioners
      </Link>

      <p
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '12px',
          color: '#B5AFA8',
          marginTop: '20px',
        }}
      >
        Redirecting in {countdown}s…
      </p>
    </>
  );
}

function ExpiredState() {
  return (
    <>
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'rgba(232,100,75,0.08)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#C0392B" strokeWidth="1.5" />
            <path d="M12 7v5" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="16" r="0.8" fill="#C0392B" />
          </svg>
        </div>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '11px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#C0392B',
          marginBottom: '10px',
        }}
      >
        Link Expired
      </div>

      <h1
        className="font-cormorant"
        style={{ fontSize: '40px', fontWeight: 300, color: '#3A3530', margin: '0 0 16px' }}
      >
        This link has expired
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
        Verification links are valid for 24 hours. Please register again to receive a new link.
      </p>

      <Link
        href="/onboarding/guide"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
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
          marginRight: '12px',
        }}
      >
        Register Again
      </Link>
      <Link
        href="/"
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '12px',
          color: '#8A8278',
          textDecoration: 'underline',
          letterSpacing: '0.05em',
        }}
      >
        Return Home
      </Link>
    </>
  );
}

function AlreadyVerifiedState() {
  return (
    <>
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'rgba(232,184,75,0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
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
      </div>

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
        Already Verified
      </div>

      <h1
        className="font-cormorant"
        style={{ fontSize: '40px', fontWeight: 300, color: '#3A3530', margin: '0 0 16px' }}
      >
        You're already verified
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
        Your email address is already confirmed. You have full access to your account.
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
          textTransform: 'uppercase',
          borderRadius: '8px',
          background: '#3A3530',
          color: '#FFFFFF',
          textDecoration: 'none',
        }}
      >
        Go to Home
      </Link>
    </>
  );
}

function InvalidState() {
  return (
    <>
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'rgba(232,100,75,0.08)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="#C0392B"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '11px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#C0392B',
          marginBottom: '10px',
        }}
      >
        Invalid Link
      </div>

      <h1
        className="font-cormorant"
        style={{ fontSize: '40px', fontWeight: 300, color: '#3A3530', margin: '0 0 16px' }}
      >
        This link is not valid
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
        The verification link is missing or malformed. Please check your email and try again,
        or contact support if the issue persists.
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
          textTransform: 'uppercase',
          borderRadius: '8px',
          background: '#3A3530',
          color: '#FFFFFF',
          textDecoration: 'none',
        }}
      >
        Return Home
      </Link>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}