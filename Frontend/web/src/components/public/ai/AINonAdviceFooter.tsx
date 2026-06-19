/**
 * Persistent "AI is not advice" disclaimer line rendered beneath every
 * AI Guide surface (home hero input, shop AI finder, practitioner-match
 * panel). Verbatim from the compliance implementation spec
 * (2026-05-22, Task 6).
 *
 * Always visible — not dismissible, not a tooltip, not a one-time
 * banner. The `variant` prop only switches between light and dark
 * backgrounds so the same component reads cleanly on the cream hero
 * and on the dark shop finder.
 */
export function AINonAdviceFooter({
  variant = 'light',
}: {
  variant?: 'light' | 'dark';
}) {
  const isLight = variant === 'light';
  return (
    <p
      role="note"
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
        lineHeight: 1.6,
        color: isLight ? '#8A8278' : 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        margin: '12px auto 0',
        maxWidth: 680,
        padding: '0 16px',
      }}
    >
      The AI Guide offers general reflections and starting points. It is not a counselor, therapist, or medical
      professional, and it does not diagnose or treat any condition. If you are in crisis or considering self-harm,
      call or text{' '}
      <a
        href="tel:988"
        style={{ color: isLight ? '#3A3530' : '#F07814', fontWeight: 500, textDecoration: 'underline' }}
      >
        988
      </a>{' '}
      (US Suicide &amp; Crisis Lifeline) or contact emergency services.
    </p>
  );
}
