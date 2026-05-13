import React from 'react';

type FormLegendProps = {
  className?: string;
  style?: React.CSSProperties;
};

export function FormLegend({ className, style }: FormLegendProps) {
  return (
    <p
      className={className}
      style={{
        fontSize: 12,
        color: 'var(--color-warm-gray)',
        margin: 0,
        ...style,
      }}
    >
      Fields marked with{' '}
      <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>
        *
      </span>{' '}
      are required.
    </p>
  );
}
