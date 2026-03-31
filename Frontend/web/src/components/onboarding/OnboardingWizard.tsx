'use client';

import { useEffect, useState } from 'react';
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
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get('/guides/onboarding/status')
      .then((res) => {
        setStatus(res.data);
        const completedSteps: number[] = res.data.completedSteps ?? [];
        // Always start at step 1 minimum — account creation is handled externally
        const resumeStep = Math.max(1, Math.min(7, completedSteps.length)) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        setStep(resumeStep);
      })
      .catch(() => {
        setStep(1);
      });
  }, [isAuthenticated, setStatus, setStep]);

  const completedSteps = status?.completedSteps ?? [];

  // Wait for Zustand hydration before rendering
  if (!mounted) return null;

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
