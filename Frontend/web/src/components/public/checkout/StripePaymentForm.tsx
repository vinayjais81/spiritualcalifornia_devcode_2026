'use client';

import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface StripePaymentFormProps {
  submitLabel: string;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
  returnUrl: string;
  cancellationNote?: string;
}

export function StripePaymentForm({ submitLabel, onSuccess, onError, returnUrl, cancellationNote }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message ?? 'Payment failed');
      onError?.(error.message ?? 'Payment failed');
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto' },
        }}
      />

      {errorMessage && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 6,
          background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
          fontSize: 13, color: '#C0392B',
        }}>
          {errorMessage}
        </div>
      )}

      {cancellationNote && (
        <div style={{
          background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)',
          borderRadius: 8, padding: '14px 18px', marginTop: 16,
          fontSize: 12, color: '#3A3530', lineHeight: 1.6,
        }}>
          <strong style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cancellation Policy</strong>
          <p style={{ marginTop: 6 }}>{cancellationNote}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          width: '100%', padding: 18, borderRadius: 8, marginTop: 20,
          background: loading ? 'rgba(232,184,75,0.5)' : '#E8B84B',
          color: '#3A3530',
          fontFamily: "'Inter', sans-serif",
          fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Processing...' : submitLabel}
      </button>

      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#8A8278' }}>
        🔒 Secured by <span style={{ color: '#E8B84B' }}>Stripe</span> · 256-bit SSL encryption
      </div>
    </form>
  );
}
