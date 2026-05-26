/**
 * Crisis-resources card surfaced whenever the AI backend signals
 * `crisis: true` on a response. Replaces the usual product /
 * practitioner result cards so the screen leads with safety
 * information, not commerce.
 *
 * Behavior contract (compliance spec Task 6):
 *   - Suspend the normal AI reply text and any recommendation cards
 *   - Show this card prominently with US-actionable phone/text
 *     resources and a brief acknowledgment
 *
 * `variant` swaps for light/dark backgrounds so the same card reads
 * on the shop AI finder (dark) and the practitioner-match panel
 * (light) without restyling.
 */
export function CrisisResourcesCard({
  reply,
  variant = 'light',
}: {
  /** Server-supplied safety reply text (verbatim from AiService.crisisResponse). */
  reply: string;
  variant?: 'light' | 'dark';
}) {
  const isLight = variant === 'light';
  const bg = isLight ? '#FDF6E3' : 'rgba(232,184,75,0.12)';
  const border = isLight ? 'rgba(192,57,43,0.35)' : 'rgba(232,184,75,0.35)';
  const text = isLight ? '#3A3530' : 'rgba(255,255,255,0.85)';
  const subtle = isLight ? '#8A8278' : 'rgba(255,255,255,0.55)';
  const accent = '#C0392B';

  return (
    <div
      role="alert"
      style={{
        marginTop: 16,
        padding: '20px 22px',
        background: bg,
        border: `1.5px solid ${border}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 10,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: accent,
          fontWeight: 600,
        }}
      >
        <span aria-hidden style={{ fontSize: 18 }}>♡</span>
        Crisis support
      </div>
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
          lineHeight: 1.65,
          color: text,
          margin: '0 0 14px',
        }}
      >
        {reply}
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          color: text,
        }}
      >
        <li>
          <strong style={{ color: text }}>988</strong>{' '}
          <span style={{ color: subtle }}>— US Suicide &amp; Crisis Lifeline (call or text, 24/7)</span>
          {' · '}
          <a href="tel:988" style={{ color: accent, textDecoration: 'underline' }}>Call</a>
          {' · '}
          <a href="sms:988" style={{ color: accent, textDecoration: 'underline' }}>Text</a>
        </li>
        <li>
          <strong style={{ color: text }}>911</strong>{' '}
          <span style={{ color: subtle }}>— Emergency services (US)</span>
          {' · '}
          <a href="tel:911" style={{ color: accent, textDecoration: 'underline' }}>Call</a>
        </li>
        <li>
          <strong style={{ color: text }}>741741</strong>{' '}
          <span style={{ color: subtle }}>— Crisis Text Line (text HOME)</span>
          {' · '}
          <a href="sms:741741&body=HOME" style={{ color: accent, textDecoration: 'underline' }}>Text HOME</a>
        </li>
      </ul>
      <p style={{ marginTop: 12, fontSize: 11, color: subtle, fontFamily: "'Inter', sans-serif" }}>
        Outside the US?{' '}
        <a
          href="https://findahelpline.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: accent, textDecoration: 'underline' }}
        >
          Find a helpline in your country
        </a>
        .
      </p>
    </div>
  );
}
