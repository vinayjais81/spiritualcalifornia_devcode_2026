'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { StripeProvider } from './StripeProvider';
import { StripePaymentForm } from './StripePaymentForm';

interface StripeCheckoutProps {
  amount: number;
  bookingId?: string;
  orderId?: string;
  ticketPurchaseId?: string;
  tourBookingId?: string;
  paymentType?: 'FULL' | 'DEPOSIT' | 'BALANCE';
  submitLabel: string;
  onSuccess: (paymentIntentId: string) => void;
  returnUrl: string;
  cancellationNote?: string;
}

/**
 * Full Stripe checkout component:
 * 1. Creates a PaymentIntent on the backend
 * 2. Wraps StripePaymentForm in Elements provider with client secret
 * 3. Handles success/error callbacks
 *
 * Falls back to the mock PaymentForm if the API call fails (dev mode without Stripe).
 */
export function StripeCheckout({
  amount, bookingId, orderId, ticketPurchaseId, tourBookingId,
  paymentType, submitLabel, onSuccess, returnUrl, cancellationNote,
}: StripeCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const createIntent = async () => {
      try {
        const res = await api.post('/payments/create-intent', {
          amount,
          bookingId,
          orderId,
          ticketPurchaseId,
          tourBookingId,
          paymentType,
        });
        setClientSecret(res.data.clientSecret);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to initialize payment. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    createIntent();
  }, [amount, bookingId, orderId, ticketPurchaseId, tourBookingId, paymentType]);

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#8A8278' }}>Initializing secure payment...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px', borderRadius: 8,
        background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
        fontSize: 13, color: '#C0392B', textAlign: 'center',
      }}>
        {error}
        <br />
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 12, padding: '8px 20px', borderRadius: 6,
            background: '#3A3530', color: '#E8B84B', border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!clientSecret) return null;

  return (
    <StripeProvider clientSecret={clientSecret}>
      <StripePaymentForm
        submitLabel={submitLabel}
        onSuccess={onSuccess}
        returnUrl={returnUrl}
        cancellationNote={cancellationNote}
      />
    </StripeProvider>
  );
}
