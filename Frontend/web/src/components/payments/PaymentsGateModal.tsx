'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, font, serif } from '@/components/guide/dashboard-ui';
import { PAYMENTS_GATE_EVENT, type PaymentsGatePayload } from '@/lib/payments-gate';

/**
 * Renders when the backend's Payments Publish Gate blocks a publish action.
 * Listens for the `paymentsGate:blocked` window event so any axios mutation
 * across the guide dashboard surfaces the same friendly modal.
 *
 * Mounted once per page that allows publishing — typically inside the guide
 * dashboard layout.
 *
 * Spec: docs/payments-publish-gate.md §6.
 */
export function PaymentsGateModal() {
  const router = useRouter();
  const [payload, setPayload] = useState<PaymentsGatePayload | null>(null);

  useEffect(() => {
    const onBlocked = (e: Event) => {
      const detail = (e as CustomEvent<PaymentsGatePayload>).detail;
      if (detail) setPayload(detail);
    };
    window.addEventListener(PAYMENTS_GATE_EVENT, onBlocked);
    return () => window.removeEventListener(PAYMENTS_GATE_EVENT, onBlocked);
  }, []);

  if (!payload) return null;

  const close = () => setPayload(null);
  const goToPayments = () => {
    close();
    router.push(payload.ctaUrl.startsWith('http') ? '/guide/dashboard/earnings' : payload.ctaUrl);
  };

  // Subtitle copy varies by the underlying reason so the guide isn't
  // surprised by what the next step is.
  const subtitle =
    payload.reason === 'payouts-disabled'
      ? "Stripe has temporarily disabled payouts on your account. Open Stripe to resolve the issue, then come back to publish."
      : payload.reason === 'onboarding-incomplete'
      ? "Your Stripe Connect onboarding isn't finished yet. Complete the form and we'll wrap this up."
      : "Set up Stripe Connect — a one-time, ~5-minute step that collects your bank account and tax info securely.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payments-gate-title"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58, 53, 48, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: 12,
          padding: 32,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
          border: '1px solid rgba(232,184,75,0.18)',
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: C.gold,
            marginBottom: 12,
          }}
        >
          Payments setup needed
        </div>

        <h2
          id="payments-gate-title"
          style={{
            fontFamily: serif,
            fontSize: 26,
            fontWeight: 400,
            color: C.charcoal,
            margin: 0,
            marginBottom: 14,
            lineHeight: 1.2,
          }}
        >
          {payload.message}
        </h2>

        <p
          style={{
            fontFamily: font,
            fontSize: 14,
            color: C.warmGray,
            lineHeight: 1.55,
            margin: 0,
            marginBottom: 8,
          }}
        >
          {subtitle}
        </p>

        <p
          style={{
            fontFamily: font,
            fontSize: 13,
            color: C.warmGray,
            lineHeight: 1.55,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Your work has been saved as a draft. Come back to publish it once setup finishes.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={close}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid rgba(58,53,48,0.18)',
              background: 'transparent',
              color: C.charcoal,
              fontFamily: font,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Maybe later
          </button>
          <button
            onClick={goToPayments}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              border: 'none',
              background: C.gold,
              color: C.charcoal,
              fontFamily: font,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {payload.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
