'use client';

interface StepNavProps {
  steps: string[];
  current: number;
  onChange?: (step: number) => void;
}

export function StepNav({ steps, current, onChange }: StepNavProps) {
  return (
    <div style={{
      background: '#fff', borderBottom: '1px solid rgba(232,184,75,0.1)',
      padding: '0 48px',
    }}>
      <div style={{
        maxWidth: 1060, margin: '0 auto',
        display: 'flex', gap: 0,
      }}>
        {steps.map((label, i) => {
          const isActive = i === current;
          const isDone = i < current;
          return (
            <button
              key={i}
              onClick={() => isDone && onChange?.(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '16px 24px', background: 'none', border: 'none',
                borderBottom: isActive ? '2px solid #E8B84B' : '2px solid transparent',
                cursor: isDone ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
                background: isActive ? '#E8B84B' : isDone ? '#5A8A6A' : 'rgba(232,184,75,0.1)',
                color: isActive || isDone ? '#fff' : '#8A8278',
              }}>
                {isDone ? '✓' : i + 1}
              </span>
              <span style={{
                fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#3A3530' : '#8A8278',
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
