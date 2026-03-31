'use client';

import { ReactNode, useState } from 'react';

interface Props {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  suffix?: ReactNode;
  multiline?: boolean;
  rows?: number;
}

export function WizardInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  hint,
  required,
  autoComplete,
  suffix,
  multiline,
  rows = 4,
}: Props) {
  const [focused, setFocused] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: suffix ? '12px 48px 12px 16px' : '12px 16px',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: '14px',
    color: '#3A3530',
    background: '#FFFFFF',
    border: `1px solid ${focused ? '#E8B84B' : 'rgba(138,130,120,0.25)'}`,
    borderRadius: '8px',
    boxShadow: focused ? '0 0 0 3px rgba(232,184,75,0.1)' : 'none',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    resize: multiline ? 'vertical' : 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#8A8278',
        }}
      >
        {label}
        {required && <span style={{ color: '#E8B84B', marginLeft: '3px' }}>*</span>}
      </label>

      <div style={{ position: 'relative' }}>
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            required={required}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={inputStyle}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            autoComplete={autoComplete}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={inputStyle}
          />
        )}

        {suffix && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {suffix}
          </div>
        )}
      </div>

      {hint && (
        <span
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '12px',
            color: '#B5AFA8',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
