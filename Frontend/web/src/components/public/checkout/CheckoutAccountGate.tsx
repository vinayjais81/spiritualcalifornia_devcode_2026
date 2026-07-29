'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';

// ═══════════════════════════════════════════════════════════════════════════
// Checkout account gate
// ═══════════════════════════════════════════════════════════════════════════
// The platform has NO guest checkout — every purchase entity (Order, Booking,
// TourBooking, Ticket) hard-requires a non-nullable `seekerId`, and every
// write endpoint is JwtAuthGuard + @Roles(SEEKER). A guest who fills a
// checkout form can therefore never submit it.
//
// So we say that BEFORE the form, never after. Rendering the form first and
// bouncing on submit is what produced the original "silent redirect discards
// everything I typed" bug report — see docs/checkout-account-gate.md.
//
// Every checkout surface renders this same panel so the wording, the CTAs and
// the `?redirect=` round-trip stay identical across Shop / Events / Tours.

/**
 * True when the account gate should be shown instead of the checkout form.
 *
 * Gated on `_hasHydrated` so a signed-in seeker never sees a flash of the
 * gate: on first paint zustand's persisted state hasn't been read from
 * localStorage yet, so `isAuthenticated` is still its `false` default.
 */
export function useCheckoutAccountGate(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  return hasHydrated && !isAuthenticated;
}

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 32px',
  borderRadius: 8,
  background: '#F07814',
  color: '#3A3530',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textDecoration: 'none',
};

const secondaryCtaStyle: React.CSSProperties = {
  ...ctaStyle,
  background: 'transparent',
  color: '#3A3530',
  border: '1.5px solid #F07814',
};

export function CheckoutAccountGate({
  redirect,
  body,
  backHref = '/cart',
  backLabel = '← Back to cart',
}: {
  /** Path to return to after auth. Round-trips through Sign In *and* Register. */
  redirect: string;
  /** Why an account is required for THIS purchase type. */
  body: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  const q = `?redirect=${encodeURIComponent(redirect)}`;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
      <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🔒</span>
      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 30,
          fontWeight: 400,
          color: '#3A3530',
          marginBottom: 12,
        }}
      >
        Sign in to complete your purchase
      </h1>
      <p style={{ fontSize: 14, color: '#8A8278', lineHeight: 1.6, marginBottom: 32 }}>{body}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href={`/signin${q}`} style={ctaStyle}>Sign In</Link>
        <Link href={`/register${q}`} style={secondaryCtaStyle}>Create Account</Link>
      </div>
      <Link
        href={backHref}
        style={{ display: 'inline-block', marginTop: 24, fontSize: 12, color: '#8A8278', textDecoration: 'none' }}
      >
        {backLabel}
      </Link>
    </div>
  );
}
