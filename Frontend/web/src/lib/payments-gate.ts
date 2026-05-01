/**
 * Helper for the Payments Publish Gate UX.
 *
 * Backend throws ForbiddenException with a structured payload when a guide
 * tries to publish a paid offering without Stripe Connect. This module:
 *   - normalizes the payload across axios errors
 *   - exposes a global custom event so any UI can mount a single modal
 *     and react to gate hits from anywhere in the app.
 *
 * Spec: docs/payments-publish-gate.md §5–§6.
 */

export const PAYMENTS_GATE_EVENT = 'paymentsGate:blocked';

export interface PaymentsGatePayload {
  message: string;
  reason?: 'no-stripe-account' | 'onboarding-incomplete' | 'payouts-disabled';
  ctaUrl: string;
  ctaLabel: string;
}

/** Pulls the gate payload out of an axios error if it matches; null otherwise. */
export function parsePaymentsGateError(err: unknown): PaymentsGatePayload | null {
  if (!err || typeof err !== 'object') return null;
  const data = (err as { response?: { status?: number; data?: any } }).response?.data;
  if (!data || data.error !== 'PAYMENT_GATE_BLOCKED') return null;
  return {
    message: data.message ?? 'Set up payment receipt before publishing a paid offering.',
    reason: data.reason,
    ctaUrl: data.ctaUrl ?? '/guide/dashboard/earnings',
    ctaLabel: data.ctaLabel ?? 'Set Up Payments',
  };
}

/** Dispatches the global event so any mounted PaymentsGateModal can render. */
export function openPaymentsGateModal(payload: PaymentsGatePayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PaymentsGatePayload>(PAYMENTS_GATE_EVENT, { detail: payload }));
}

/** Convenience: parse + open in one call. Returns true if the error was a gate hit. */
export function handlePaymentsGateError(err: unknown): boolean {
  const payload = parsePaymentsGateError(err);
  if (!payload) return false;
  openPaymentsGateModal(payload);
  return true;
}
