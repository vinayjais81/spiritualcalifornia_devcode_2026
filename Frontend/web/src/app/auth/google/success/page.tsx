'use client';

/*import { useEffect } from 'react';*/
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

function GoogleSuccessContent() {

  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const roles = searchParams.get('roles')?.split(',') ?? [];
    const isNewUser = searchParams.get('new') === '1';

    if (!token) {
      router.replace('/signin?error=google_failed');
      return;
    }

    // Check if there's a pending redirect (e.g., from booking flow)
    let pendingRedirect: string | null = null;
    try { pendingRedirect = sessionStorage.getItem('sc-auth-redirect'); sessionStorage.removeItem('sc-auth-redirect'); } catch {}

    // Fetch the full user profile using the access token
    api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async ({ data }) => {
        setAuth(data, token);
        const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
        const isGuide = roles.includes('GUIDE');
        const isSeeker = roles.includes('SEEKER');

        // If there's a pending redirect (e.g., booking page), go there first
        if (pendingRedirect && !isNewUser) {
          router.replace(pendingRedirect);
          return;
        }

        if (isAdmin) { router.replace('/dashboard'); return; }
        if (isGuide) { router.replace('/onboarding/guide'); return; }
        if (isNewUser) {
          // New Google seeker — seeker profile created with onboardingStep=1 (default)
          // from=google tells register page to skip account-creation form and start at step 2
          router.replace('/register?from=google');
          return;
        }
        if (isSeeker) {
          // Existing Google seeker returning — check if registration was completed
          try {
            const { data: status } = await api.get('/seekers/onboarding/status', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!status.completed) {
              router.replace(`/register?from=google&step=${status.step > 1 ? status.step : 2}`);
            } else {
              router.replace('/');
            }
          } catch {
            router.replace('/');
          }
        } else {
          router.replace('/');
        }
      })
      .catch(() => router.replace('/signin?error=google_failed'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter), sans-serif', color: '#8A8278' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌸</div>
        <p style={{ fontSize: 14 }}>Signing you in…</p>
      </div>
    </div>
  );
}

export default function GoogleSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GoogleSuccessContent />
    </Suspense>
  );
}
