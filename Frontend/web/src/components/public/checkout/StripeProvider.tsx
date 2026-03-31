'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

export function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  return (
    <Elements
      stripe={stripePromise}
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
