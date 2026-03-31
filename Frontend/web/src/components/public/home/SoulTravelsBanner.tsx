'use client';

import Image from 'next/image';
import Link from 'next/link';

export function SoulTravelsBanner() {
  return (
    <section
      id="travels"
      style={{ position: 'relative', height: '440px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Background image */}
      <Image
        src="/images/poppy_field.jpg"
        alt="Soul Travels"
        fill
        sizes="100vw"
        className="object-cover"
        style={{ filter: 'brightness(0.62) saturate(0.8)' }}
        priority={false}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', color: '#FFFFFF', padding: '0 40px' }}>
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#F5D98A',
            marginBottom: '14px',
          }}
        >
          Soul Travels
        </div>

        <h2
          className="font-cormorant"
          style={{
            fontSize: 'clamp(38px, 5.5vw, 68px)',
            fontWeight: 300,
            fontStyle: 'italic',
            lineHeight: 1.1,
            marginBottom: '18px',
          }}
        >
          Journey Beyond<br />the Ordinary
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '13px',
            fontWeight: 300,
            letterSpacing: '0.03em',
            opacity: 0.85,
            marginBottom: '32px',
            maxWidth: '460px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.7,
          }}
        >
          Immersive trips to Nepal, Cambodia, India & Sri Lanka — where you experience authentic local spiritual
          traditions far beyond the tourist trail.
        </p>

        <Link
          href="/travels"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            border: '1.5px solid rgba(255,255,255,0.6)',
            borderRadius: '50px',
            padding: '13px 32px',
            textDecoration: 'none',
            transition: 'background 0.3s, border-color 0.3s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = 'rgba(255,255,255,0.15)';
            el.style.borderColor = '#FFFFFF';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = 'transparent';
            el.style.borderColor = 'rgba(255,255,255,0.6)';
          }}
        >
          Explore Journeys
        </Link>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #travels { height: 320px !important; }
        }
        @media (max-width: 480px) {
          #travels { height: 280px !important; }
        }
      `}</style>
    </section>
  );
}
