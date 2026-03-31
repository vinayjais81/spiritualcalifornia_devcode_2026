'use client';

import { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
}

export function WizardFormCard({ eyebrow, title, subtitle, children }: Props) {
  return (
    <div>
      {/* Step header */}
      <div style={{ marginBottom: '44px' }}>
        {eyebrow && (
          <div
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#E8B84B',
              marginBottom: '10px',
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="font-cormorant"
          style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 300,
            lineHeight: 1.1,
            color: '#3A3530',
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '14px',
              color: '#8A8278',
              lineHeight: 1.7,
              marginTop: '10px',
              marginBottom: 0,
              maxWidth: '560px',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}
