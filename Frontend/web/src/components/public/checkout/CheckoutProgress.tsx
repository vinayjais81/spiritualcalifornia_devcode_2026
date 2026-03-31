interface CheckoutProgressProps {
  steps: string[];
  current: number;
}

export function CheckoutProgress({ steps, current }: CheckoutProgressProps) {
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid rgba(232,184,75,0.1)', padding: '16px 48px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {steps.map((label, i) => {
          const isDone = i < current;
          const isActive = i === current;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 40, height: 1, background: isDone ? '#E8B84B' : 'rgba(232,184,75,0.2)' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                  background: isDone ? '#5A8A6A' : isActive ? '#E8B84B' : 'rgba(232,184,75,0.1)',
                  color: isDone || isActive ? '#fff' : '#8A8278',
                }}>
                  {isDone ? '✓' : i + 1}
                </span>
                <span style={{
                  fontSize: 11, letterSpacing: '0.06em', fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#3A3530' : '#8A8278',
                }}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
