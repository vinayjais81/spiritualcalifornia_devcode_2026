'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/apiError';

/**
 * "Remove my information" from a practitioner invite email.
 *
 * Two properties this page must have, both easy to get wrong:
 *
 *   1. **Nothing is deleted by loading it.** Corporate mail scanners and
 *      link-preview bots follow every URL in an email, so removal happens on an
 *      explicit button press (POST), never on page load.
 *   2. **No sign-in.** The recipient has no password — the account was created
 *      for them — and requiring one to leave would be indefensible.
 */

const G = {
  gold: '#F07814',
  goldPale: '#FEF7F0',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#F5F2EB',
  white: '#FFFFFF',
  red: '#C0392B',
  green: '#5A8A6A',
};

interface Describe {
  valid: boolean;
  reason?: string;
  alreadyRemoved?: boolean;
  firstName?: string;
  displayName?: string;
  email?: string;
  supportEmail?: string;
}

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'done' | 'already'>('loading');
  const [info, setInfo] = useState<Describe | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deactivatedInstead, setDeactivatedInstead] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    api
      .get(`/invites/unsubscribe/${encodeURIComponent(token)}`)
      .then(({ data }) => {
        setInfo(data);
        if (!data.valid) setState('invalid');
        else if (data.alreadyRemoved) setState('already');
        else setState('ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post(`/invites/unsubscribe/${encodeURIComponent(token)}`);
      setDeactivatedInstead(!!data?.deactivatedInstead);
      setState('done');
    } catch (e: unknown) {
      setError(apiErrorMessage(e, 'We could not complete that. Please email us and we will remove you by hand.'));
    } finally {
      setSubmitting(false);
    }
  };

  const supportEmail = info?.supportEmail ?? 'support@spiritualcalifornia.com';

  return (
    <div style={{ minHeight: '100vh', background: G.offWhite, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: 520, background: G.white, border: '1px solid rgba(240,120,20,0.2)', borderRadius: 12, padding: 'clamp(28px, 6vw, 44px)' }}>
        <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 14 }}>
          Spiritual California
        </div>

        {state === 'loading' && (
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.warmGray }}>
            Checking your link…
          </p>
        )}

        {state === 'invalid' && (
          <>
            <h1 style={titleStyle}>This link isn&rsquo;t valid</h1>
            <p style={bodyStyle}>
              It may have already been used, or been altered in transit. Nothing has
              been changed. Email{' '}
              <a href={`mailto:${supportEmail}`} style={linkStyle}>{supportEmail}</a>{' '}
              and we will remove your information by hand.
            </p>
          </>
        )}

        {state === 'already' && (
          <>
            <h1 style={titleStyle}>You&rsquo;re already removed</h1>
            <p style={bodyStyle}>
              Your information is no longer on Spiritual California, and we won&rsquo;t
              contact you again.
            </p>
          </>
        )}

        {state === 'ready' && (
          <>
            <h1 style={titleStyle}>
              Remove your information?
            </h1>
            <p style={bodyStyle}>
              We reserved a profile for{' '}
              <strong style={{ color: G.charcoal }}>{info?.displayName ?? 'you'}</strong>
              {info?.email ? <> ({info.email})</> : null}. It has never been
              published or shown publicly.
            </p>
            <p style={bodyStyle}>
              Confirming will <strong style={{ color: G.charcoal }}>permanently delete</strong>{' '}
              the profile and your contact details, and add your address to our
              do-not-contact list so a future import can&rsquo;t bring you back.
            </p>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: '#DC2626', marginBottom: 18 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26 }}>
              <button
                type="button"
                onClick={confirm}
                disabled={submitting}
                style={{
                  padding: '14px 28px', borderRadius: 8, border: 'none',
                  background: submitting ? '#B5AFA8' : G.red, color: G.white,
                  fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, fontWeight: 600,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                {submitting ? 'Removing…' : 'Remove my information'}
              </button>
              <Link
                href="/"
                style={{
                  padding: '14px 28px', borderRadius: 8,
                  border: `1.5px solid ${G.gold}`, background: 'transparent', color: G.charcoal,
                  fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, fontWeight: 600,
                  letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none',
                }}
              >
                Keep my profile
              </Link>
            </div>
          </>
        )}

        {state === 'done' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h1 style={titleStyle}>You&rsquo;ve been removed</h1>
            <p style={bodyStyle}>
              {deactivatedInstead
                ? 'Your profile is no longer visible and we will not contact you again. Because your account had activity on the platform, a record is retained for our financial obligations only — email us if you would like it reviewed.'
                : 'Your profile and contact details have been deleted, and we won’t contact you again.'}
            </p>
            <p style={{ ...bodyStyle, marginBottom: 0 }}>
              If this was a mistake, email{' '}
              <a href={`mailto:${supportEmail}`} style={linkStyle}>{supportEmail}</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-playfair-display), Georgia, serif',
  fontSize: 'clamp(26px, 5vw, 32px)',
  fontWeight: 400,
  color: G.charcoal,
  lineHeight: 1.2,
  margin: '0 0 16px',
};

const bodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 14,
  color: G.warmGray,
  lineHeight: 1.7,
  margin: '0 0 14px',
};

const linkStyle: React.CSSProperties = {
  color: G.gold,
  textDecoration: 'none',
  borderBottom: `1px solid ${G.gold}`,
};

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter), sans-serif', color: '#8A8278' }}>
          Loading…
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
