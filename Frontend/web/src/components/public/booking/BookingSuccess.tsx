import Link from 'next/link';

interface BookingSuccessProps {
  title: string;
  subtitle: string;
  details: Array<{ label: string; value: string }>;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

export function BookingSuccess({ title, subtitle, details, primaryAction, secondaryAction }: BookingSuccessProps) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
        background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32,
      }}>
        ✓
      </div>
      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 10,
      }}>
        {title}
      </h1>
      <p style={{ fontSize: 14, color: '#8A8278', lineHeight: 1.6, marginBottom: 32 }}>
        {subtitle}
      </p>

      <div style={{
        background: '#fff', border: '1px solid rgba(232,184,75,0.15)',
        borderRadius: 12, padding: 24, textAlign: 'left', marginBottom: 32,
      }}>
        {details.map((d, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 0',
            borderBottom: i < details.length - 1 ? '1px solid rgba(232,184,75,0.1)' : 'none',
          }}>
            <span style={{ fontSize: 12, color: '#8A8278' }}>{d.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#3A3530' }}>{d.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        {secondaryAction && (
          <Link href={secondaryAction.href} style={{
            padding: '14px 28px', borderRadius: 8,
            border: '1.5px solid rgba(232,184,75,0.3)', background: 'transparent',
            fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#3A3530', textDecoration: 'none',
          }}>
            {secondaryAction.label}
          </Link>
        )}
        <Link href={primaryAction.href} style={{
          padding: '14px 28px', borderRadius: 8,
          background: '#E8B84B', color: '#3A3530',
          fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          textDecoration: 'none',
        }}>
          {primaryAction.label}
        </Link>
      </div>
    </div>
  );
}
