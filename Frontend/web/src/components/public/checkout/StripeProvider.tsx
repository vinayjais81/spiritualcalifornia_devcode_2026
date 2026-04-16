'use client';

import { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

export function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      setError('Stripe publishable key is not configured.');
      return;
    }

    loadStripe(key).then((s) => {
      if (s) {
        setStripe(s);
      } else {
        setError('Stripe returned null. Key may be invalid. Check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
      }
    }).catch((err) => {
      setError(`Stripe load error: ${err?.message || String(err)}`);
    });
  }, []);

  if (error) {
    return (
      <div style={{
        padding: '14px 18px', borderRadius: 8, marginBottom: 16,
        background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
        fontSize: 13, color: '#C0392B',
      }}>
        {error}
      </div>
    );
  }

  if (!stripe) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: '#8A8278' }}>
        Loading Stripe...
      </div>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#E8B84B',
            colorBackground: '#FAFAF7',
            colorText: '#3A3530',
            colorDanger: '#C0392B',
            fontFamily: "'Inter', sans-serif",
            borderRadius: '6px',
          },
          rules: {
            '.Input': {
              border: '1.5px solid rgba(232,184,75,0.2)',
              padding: '12px 14px',
            },
            '.Input:focus': {
              borderColor: '#E8B84B',
              boxShadow: '0 0 0 1px #E8B84B',
            },
            '.Label': {
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8A8278',
            },
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}
