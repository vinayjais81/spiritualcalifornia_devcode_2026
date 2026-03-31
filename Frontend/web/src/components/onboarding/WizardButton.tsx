'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'back' | 'skip';
}

export function WizardButton({ children, loading, variant = 'primary', style, disabled, ...rest }: Props) {
  const isBack = variant === 'back';
  const isSkip = variant === 'skip';

  if (isBack) {
    return (
      <button
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: 0,
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '12px',
          fontWeight: 400,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#8A8278',
          background: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'color 0.3s',
          ...style,
        }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = '#3A3530'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8A8278'; }}
        {...rest}
      >
        {children}
      </button>
    );
  }

  if (isSkip) {
    return (
      <button
        disabled={disabled}
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '12px',
          color: '#8A8278',
          background: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textDecoration: 'underline',
          letterSpacing: '0.05em',
          ...style,
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }

  // primary (next / submit)
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '14px 36px',
        fontFamily: 'var(--font-inter), sans-serif',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        borderRadius: '8px',
        border: 'none',
        background: disabled || loading ? '#B5AFA8' : '#3A3530',
        color: '#FFFFFF',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.3s',
        ...style,
      }}
      onMouseEnter={e => { if (!disabled && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#E8B84B'; }}
      onMouseLeave={e => { if (!disabled && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#3A3530'; }}
      {...rest}
    >
      {loading && (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#FFFFFF',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      )}
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
