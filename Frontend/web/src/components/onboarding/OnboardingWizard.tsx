'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { ProgressStepper } from './ProgressStepper';
import { Step1Profile } from './steps/Step1Profile';
import { Step2Services } from './steps/Step2Services';
import { Step3Credentials } from './steps/Step3Credentials';
import { Step4Identity } from './steps/Step4Identity';
import { Step5Calendar } from './steps/Step5Calendar';
import { Step6Products } from './steps/Step6Products';
import { Step7GoLive } from './steps/Step7GoLive';
import type { Category } from '@/types/onboarding';

export function OnboardingWizard() {
  const { step, status, categories, setCategories, setStatus, setStep } = useOnboardingStore();
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  // Cross-role guard: SEEKER and GUIDE are mutually exclusive on the same
  // email. If a logged-in seeker lands here, we render a friendly block
  // instead of the wizard. ADMIN/SUPER_ADMIN are exempt — staff can wear
  // both hats for testing.
  const userRoles = user?.roles ?? [];
  const isAdminClass =
    userRoles.includes('ADMIN' as never) ||
    userRoles.includes('SUPER_ADMIN' as never);
  const isExistingSeeker =
    isAuthenticated &&
    !isAdminClass &&
    userRoles.includes('SEEKER' as never) &&
    !userRoles.includes('GUIDE' as never);

  // Wait for Zustand hydration before rendering
  useEffect(() => { setMounted(true); }, []);

  // Ensure all users start at step 1 minimum
  useEffect(() => {
    if (!mounted) return;
    if (step === 0) setStep(1);
  }, [mounted, step, setStep]);

  // Only fetch categories once authenticated — endpoint is protected
  useEffect(() => {
    if (!isAuthenticated) return;
    if (categories.length > 0) return;
    api
      .get<Category[]>('/guides/categories')
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, [isAuthenticated, categories.length, setCategories]);

  // Once email is verified AND the guide has actually started onboarding
  // (i.e. their GuideProfile + GUIDE role exist) we treat them as
  // "registered enough" and drop them onto /guide/dashboard. The remaining
  // wizard steps (categories, profile, credentials, submit-for-verification)
  // are surfaced as a ProfileCompletenessWidget on the dashboard.
  //
  // We deliberately DO NOT redirect users who are email-verified but haven't
  // yet hit /guides/onboarding/start — they don't have the GUIDE role, so
  // /guide/dashboard would just bounce them right back here, creating a
  // redirect loop. This catches:
  //   - brand-new guide registrations mid-wizard
  //   - existing seekers (email-verified) who just navigated to
  //     /onboarding/guide for the first time to also become a guide
  //
  // A guide who explicitly wants the linear wizard back can opt in via
  // `?resume=1`.
  useEffect(() => {
    if (!isAuthenticated) return;
    const wantsResume = searchParams.get('resume') === '1';
    api
      .get('/guides/onboarding/status')
      .then((res) => {
        setStatus(res.data);
        if (res.data?.started && res.data?.isEmailVerified && !wantsResume) {
          router.replace('/guide/dashboard');
          return;
        }
        const completedSteps: number[] = res.data.completedSteps ?? [];
        // Always start at step 1 minimum — account creation is handled externally
        const resumeStep = Math.max(1, Math.min(7, completedSteps.length)) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        setStep(resumeStep);
      })
      .catch(() => {
        setStep(1);
      });
  }, [isAuthenticated, setStatus, setStep, router, searchParams]);

  const completedSteps = status?.completedSteps ?? [];

  // Wait for Zustand hydration before rendering
  if (!mounted) return null;

  // Cross-role block: an existing seeker cannot also become a guide on the
  // same email. Render a clear page instead of the wizard so the user
  // knows exactly what to do (sign out → register again with a new email).
  if (isExistingSeeker) return <CrossRoleBlock />;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7', fontFamily: 'var(--font-inter), sans-serif' }}>

      {/* ── NAV (fixed) ─────────────────────────────────────────── */}
      <nav
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 48px',
          background: 'rgba(250,250,247,0.95)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(232,184,75,0.15)',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <Image
            src="/images/logo.jpg"
            alt="Spiritual California"
            width={40}
            height={40}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span
              className="font-cormorant"
              style={{ fontSize: '18px', fontWeight: 500, color: '#3A3530', letterSpacing: '0.04em' }}
            >
              Spiritual California
            </span>
            <span
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '9px',
                fontWeight: 400,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#8A8278',
                marginTop: '2px',
              }}
            >
              mind · body · soul
            </span>
          </div>
        </Link>

        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#8A8278',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(138,130,120,0.3)',
            paddingBottom: '2px',
            transition: 'color 0.3s, border-color 0.3s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.color = '#E8B84B';
            el.style.borderColor = '#E8B84B';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.color = '#8A8278';
            el.style.borderColor = 'rgba(138,130,120,0.3)';
          }}
        >
          ← Back to Home
        </Link>
      </nav>

      {/* ── PROGRESS BAR ────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: '69px',
          left: 0,
          right: 0,
          zIndex: 99,
          background: '#FFFFFF',
          borderBottom: '1px solid rgba(232,184,75,0.1)',
          padding: '0 48px',
          overflowX: 'auto',
        }}
      >
        <ProgressStepper currentStep={step} completedSteps={completedSteps} />
      </div>

      {/* ── STEP CONTENT ─────────────────────────────────────────── */}
      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '160px 24px 80px' }}>
        {step === 1 && <Step1Profile />}
        {step === 2 && <Step2Services />}
        {step === 3 && <Step3Credentials />}
        {step === 4 && <Step4Identity />}
        {step === 5 && <Step5Calendar />}
        {step === 6 && <Step6Products />}
        {step === 7 && <Step7GoLive />}
      </main>

      {/* ── FOOTER NOTE ─────────────────────────────────────────── */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '12px',
          color: '#B5AFA8',
        }}
      >
        Your information is encrypted and used only for verification purposes.
      </footer>

      <style>{`
        @media (max-width: 640px) {
          nav { padding: 12px 20px !important; }
          main { padding: 140px 16px 60px !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Cross-role block ────────────────────────────────────────────────────────

/**
 * Shown when a logged-in seeker tries to enter the guide wizard. Seekers
 * and guides are mutually exclusive on the same email — they need to sign
 * out and register again with a different email if they want to also be
 * a guide. ADMIN/SUPER_ADMIN are exempt from this rule and never reach
 * this branch.
 */
function CrossRoleBlock() {
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleSignOutAndRegister = async () => {
    try {
      await logout();
    } catch {
      // logout API may fail; we still want to wipe local state and route
      // the user to the registration form.
    }
    router.push('/onboarding/guide');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          textAlign: 'center',
          background: '#fff',
          border: '1px solid rgba(232,184,75,0.25)',
          borderRadius: 12,
          padding: '40px 36px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#E8B84B',
            marginBottom: 14,
            fontWeight: 500,
          }}
        >
          ✦ This email is already a seeker
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-cormorant-garamond), serif',
            fontSize: 32,
            fontWeight: 400,
            color: '#3A3530',
            lineHeight: 1.2,
            margin: '0 0 14px',
          }}
        >
          One email,{' '}
          <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>one role</em>
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#8A8278',
            lineHeight: 1.7,
            margin: '0 0 28px',
          }}
        >
          Your account is already registered as a seeker on Spiritual
          California. Seekers and guides are kept separate so each profile
          stays focused. To register as a guide, please sign out and register
          again using a different email address.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleSignOutAndRegister}
            style={{
              padding: '12px 24px',
              background: '#3A3530',
              color: '#fff',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Sign out & register as guide
          </button>
          <Link
            href="/seeker/dashboard"
            style={{
              padding: '12px 24px',
              border: '1px solid rgba(232,184,75,0.4)',
              color: '#3A3530',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Back to my dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
