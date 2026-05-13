import React from 'react';

type FieldLabelProps = {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function FieldLabel({
  htmlFor,
  required = false,
  children,
  className,
  style,
}: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={className} style={style}>
      {children}
      {required && (
        <span
          aria-hidden="true"
          style={{ color: 'var(--color-error)', marginLeft: 4 }}
        >
          *
        </span>
      )}
    </label>
  );
}
