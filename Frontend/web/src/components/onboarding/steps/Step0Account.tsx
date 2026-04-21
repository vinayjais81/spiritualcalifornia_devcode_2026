'use client';

import { useState, FormEvent } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { refreshAuthWithLatestRoles } from '@/lib/refreshAuth';
import { WizardFormCard } from '../WizardFormCard';
import { WizardInput } from '../WizardInput';
import { WizardButton } from '../WizardButton';

export function Step0Account() {
  const { step0, setStep0, setLoading, isLoading, setError, error, nextStep } = useOnboardingStore();
  const { isAuthenticated, user, setAuth } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'register' | 'login' | 'already'>(
    isAuthenticated ? 'already' : 'register',
  );

  // Already authenticated — just start onboarding
  const handleStartOnboarding = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/guides/onboarding/start');
      // GUIDE role was just added to the DB; the existing JWT is stale.
      // Rotate it so subsequent guide API calls pass @Roles(GUIDE) guards.
      await refreshAuthWithLatestRoles();
      nextStep();
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Could not start onboarding. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await api.post('/auth/register', {
        firstName: step0.firstName,
        lastName: step0.lastName,
        email: step0.email,
        password: step0.password,
      });
      setAuth(authData.user, authData.accessToken);
      await api.post('/guides/onboarding/start');
      await refreshAuthWithLatestRoles();
      nextStep();
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Registration failed. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await api.post('/auth/login', {
        email: step0.email,
        password: step0.password,
      });
      setAuth(authData.user, authData.accessToken);
      await api.post('/guides/onboarding/start');
      await refreshAuthWithLatestRoles();
      nextStep();
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Login failed. Please check your credentials.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const switchToLogin = () => {
    useAuthStore.getState().clearAuth();
    setMode('login');
  };

  // ── Already signed in ──────────────────────────────────────────────────────
  if (mode === 'already' && isAuthenticated && user) {
    return (
      <WizardFormCard
        eyebrow="Account"
        title={<>Welcome back, <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>{user.firstName}</em></>}
        subtitle={`Signed in as ${user.firstName} ${user.lastName}. Let's set up your guide profile.`}
      >
        {error && <ErrorBanner message={error} />}
        <WizardButton onClick={handleStartOnboarding} loading={isLoading}>
          Continue as {user.firstName}
        </WizardButton>
        <p style={switchStyle}>
          Not you?{' '}
          <button style={linkStyle} onClick={switchToLogin}>
            Sign in with a different account
          </button>
        </p>
      </WizardFormCard>
    );
  }

  // ── Login form ─────────────────────────────────────────────────────────────
  if (mode === 'login') {
    return (
      <WizardFormCard
        eyebrow="Account"
        title={<>Sign in to <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>continue</em></>}
        subtitle="Use your existing Spiritual California account."
      >
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && <ErrorBanner message={error} />}
          <WizardInput
            label="Email address"
            type="email"
            value={step0.email}
            onChange={(v) => setStep0({ email: v })}
            autoComplete="email"
            required
          />
          <WizardInput
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={step0.password}
            onChange={(v) => setStep0({ password: v })}
            autoComplete="current-password"
            required
            suffix={
              <button type="button" style={eyeStyle} onClick={() => setShowPassword((p) => !p)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          />
          <WizardButton type="submit" loading={isLoading}>
            Sign in & Continue
          </WizardButton>
        </form>
        <p style={switchStyle}>
          New to Spiritual California?{' '}
          <button style={linkStyle} onClick={() => setMode('register')}>
            Create an account
          </button>
        </p>
      </WizardFormCard>
    );
  }

  // ── Register form (default) ────────────────────────────────────────────────
  return (
    <WizardFormCard
      eyebrow="Account"
      title={<>Create your <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>guide account</em></>}
      subtitle="Start your journey as a verified guide on Spiritual California."
    >
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <ErrorBanner message={error} />}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <WizardInput
            label="First name"
            type="text"
            value={step0.firstName}
            onChange={(v) => setStep0({ firstName: v })}
            autoComplete="given-name"
            required
          />
          <WizardInput
            label="Last name"
            type="text"
            value={step0.lastName}
            onChange={(v) => setStep0({ lastName: v })}
            autoComplete="family-name"
            required
          />
        </div>

        <WizardInput
          label="Email address"
          type="email"
          value={step0.email}
          onChange={(v) => setStep0({ email: v })}
          autoComplete="email"
          required
        />

        <WizardInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={step0.password}
          onChange={(v) => setStep0({ password: v })}
          autoComplete="new-password"
          required
          hint="At least 8 characters"
          suffix={
            <button type="button" style={eyeStyle} onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          }
        />

        <WizardButton type="submit" loading={isLoading}>
          Create Account & Continue
        </WizardButton>
      </form>

      <p style={switchStyle}>
        Already have an account?{' '}
        <button style={linkStyle} onClick={() => setMode('login')}>
          Sign in instead
        </button>
      </p>
    </WizardFormCard>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '13px',
        color: '#DC2626',
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      {message}
    </div>
  );
}

const switchStyle: React.CSSProperties = {
  textAlign: 'center',
  marginTop: '20px',
  fontSize: '13px',
  fontFamily: 'var(--font-inter), sans-serif',
  color: '#8A8278',
};

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: '#E8B84B',
  fontWeight: 600,
  fontSize: '13px',
  fontFamily: 'var(--font-inter), sans-serif',
  textDecoration: 'underline',
};

const eyeStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 500,
  color: '#8A8278',
  fontFamily: 'var(--font-inter), sans-serif',
  padding: '0 4px',
};
