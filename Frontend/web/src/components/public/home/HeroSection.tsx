'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AINonAdviceFooter } from '@/components/public/ai/AINonAdviceFooter';

const poppyItems = [
  { label: 'Practitioners', href: '/practitioners', image: '/images/hero1.jpg' },
  { label: 'Shop',          href: '/shop',          image: '/images/ayurveda.jpg' },
  { label: 'Soul Travels',  href: '/travels',       image: '/images/poppy_close.jpg' },
  { label: 'Events',        href: '/events',        image: '/images/yoga_outdoor.jpg' },
];

const hintChips = [
  'Feeling anxious',
  'Low energy',
  'Seeking meaning',
  'Curious about meditation',
  'Burnout',
];

export function HeroSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function fillChip(text: string) {
    if (inputRef.current) inputRef.current.value = text;
    // Don't auto-submit on chip click — the user might still want to edit.
    // Just fill and focus so they can refine or press Enter / Guide Me.
    inputRef.current?.focus();
  }

  // Hero queries are intent-driven ("feeling anxious", "low energy", etc.),
  // so we route to /practitioners?q=… where the AI Guide picks up the
  // query string and fires POST /ai/practitioner-match against Claude.
  // Cross-entity keyword search lives in the navbar magnifier modal —
  // different tool for a different need.
  function submitQuery() {
    const q = inputRef.current?.value?.trim();
    if (!q) {
      router.push('/practitioners');
      return;
    }
    router.push(`/practitioners?q=${encodeURIComponent(q)}`);
  }

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '110px 60px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Botanical SVG backgrounds */}
      <svg
        style={{ position: 'absolute', top: '-60px', right: '-80px', width: '460px', opacity: 0.07, pointerEvents: 'none' }}
        viewBox="0 0 400 500" fill="none"
        aria-hidden
      >
        <path d="M200 480 C200 480 180 380 120 300 C60 220 20 160 80 80 C140 0 220 40 240 120 C260 200 200 280 220 360 C240 440 200 480 200 480Z" stroke="#F07814" strokeWidth="1.5" fill="none"/>
        <path d="M200 480 C200 480 220 380 280 300 C340 220 380 160 320 80" stroke="#F07814" strokeWidth="1" fill="none"/>
        <circle cx="80" cy="80" r="28" stroke="#F07814" strokeWidth="1.2" fill="none"/>
        <circle cx="320" cy="80" r="22" stroke="#F07814" strokeWidth="1" fill="none"/>
        <circle cx="200" cy="40" r="18" stroke="#F07814" strokeWidth="1" fill="none"/>
      </svg>
      <svg
        style={{ position: 'absolute', bottom: '40px', left: '-60px', width: '300px', opacity: 0.07, pointerEvents: 'none' }}
        viewBox="0 0 300 400" fill="none"
        aria-hidden
      >
        <path d="M150 380 C150 380 100 300 60 220 C20 140 10 80 70 40 C130 0 180 50 170 130 C160 210 150 380 150 380Z" stroke="#F07814" strokeWidth="1.2" fill="none"/>
        <circle cx="70" cy="40" r="24" stroke="#F07814" strokeWidth="1" fill="none"/>
        <circle cx="150" cy="20" r="16" stroke="#F07814" strokeWidth="0.8" fill="none"/>
      </svg>

      {/* AI Guide input — top of hero */}
      <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto 40px', position: 'relative', zIndex: 2 }}>
        <p
          className="font-playfair"
          style={{ fontSize: '28px', fontWeight: 500, fontStyle: 'normal', color: '#F07814', textAlign: 'center', marginBottom: '8px' }}
        >
          How Do You Feel Today?
        </p>
        <p
          className="hero-sub"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '13px',
            fontWeight: 300,
            letterSpacing: '0.08em',
            color: '#8A8278',
            textAlign: 'center',
            marginBottom: '18px',
          }}
        >
          Ask the AI Guide &nbsp;·&nbsp; Explore Practitioners &nbsp;·&nbsp; Discover Soul Travels
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#FFFFFF',
            border: '1.5px solid rgba(240,120,20,0.5)',
            borderRadius: '50px',
            padding: '12px 18px 12px 26px',
            boxShadow: '0 4px 30px rgba(240,120,20,0.1)',
            transition: 'box-shadow 0.3s, border-color 0.3s',
          }}
          onFocusCapture={e => {
            const wrap = e.currentTarget as HTMLDivElement;
            wrap.style.borderColor = '#F07814';
            wrap.style.boxShadow = '0 4px 40px rgba(240,120,20,0.2)';
          }}
          onBlurCapture={e => {
            const wrap = e.currentTarget as HTMLDivElement;
            wrap.style.borderColor = 'rgba(240,120,20,0.5)';
            wrap.style.boxShadow = '0 4px 30px rgba(240,120,20,0.1)';
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="I feel burnt out and disconnected…"
            onKeyDown={(e) => { if (e.key === 'Enter') submitQuery(); }}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '13px',
              fontWeight: 300,
              color: '#3A3530',
              background: 'transparent',
            }}
          />
          <button
            onClick={submitQuery}
            style={{
              background: '#F07814',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '50px',
              padding: '9px 22px',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.3s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#D4A43A')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#F07814')}
          >
            Guide Me
          </button>
        </div>

        {/* Hint chips */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
          {hintChips.map(chip => (
            <button
              key={chip}
              onClick={() => fillChip(chip)}
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '11px',
                color: '#8A8278',
                background: 'transparent',
                border: '1px solid rgba(138,130,120,0.3)',
                borderRadius: '50px',
                padding: '5px 13px',
                cursor: 'pointer',
                transition: 'border-color 0.3s, color 0.3s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = '#F07814';
                el.style.color = '#F07814';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = 'rgba(138,130,120,0.3)';
                el.style.color = '#8A8278';
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Compliance: persistent AI non-advice disclaimer. Required on
            every AI Guide surface per Task 6 of the compliance spec.
            Crisis detection itself runs server-side on the receiving
            /practitioners page where the AI call actually happens. */}
        <AINonAdviceFooter />
      </div>

      {/* Headline */}
      <h1
        className="font-playfair hero-headline"
        style={{
          fontSize: 'clamp(52px, 8.5vw, 108px)',
          fontWeight: 300,
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
          color: '#3A3530',
          textAlign: 'center',
          maxWidth: '900px',
          marginBottom: '28px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        Find Your Path.
      </h1>

      {/* Poppy nav circles — all 200px */}
      <div className="poppy-nav" style={{ display: 'flex', gap: '28px', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '60px', position: 'relative', zIndex: 2 }}>
        {poppyItems.map(({ label, href, image }) => (
          <Link key={href} href={href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }} className="poppy-item">
            <div
              className="poppy-circle"
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2.5px solid #F07814',
                position: 'relative',
                transition: 'transform 0.4s ease, box-shadow 0.4s ease',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-6px)';
                el.style.boxShadow = '0 20px 50px rgba(240,120,20,0.25)';
                const img = el.querySelector('img') as HTMLImageElement | null;
                if (img) img.style.filter = 'saturate(1.1)';
                const label = el.closest('a')?.querySelector('span') as HTMLSpanElement | null;
                if (label) label.style.color = '#F07814';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = 'none';
                const img = el.querySelector('img') as HTMLImageElement | null;
                if (img) img.style.filter = 'saturate(0.9)';
                const label = el.closest('a')?.querySelector('span') as HTMLSpanElement | null;
                if (label) label.style.color = '#8A8278';
              }}
            >
              <Image
                src={image}
                alt={label}
                fill
                sizes="200px"
                className="object-cover object-top"
                style={{ filter: 'saturate(0.9)', transition: 'filter 0.4s' }}
              />
              {/* Gold radial overlay */}
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(240,120,20,0.1) 100%)', pointerEvents: 'none' }} />
            </div>
            <div style={{ width: '1.5px', height: '44px', background: 'linear-gradient(to bottom, #F07814, transparent)', marginTop: '4px' }} />
            <span
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#8A8278',
                marginTop: '10px',
                transition: 'color 0.3s',
              }}
            >
              {label}
            </span>
          </Link>
        ))}
      </div>

      {/* Scroll hint */}
      <div
        className="scroll-hint animate-sc-bounce"
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          opacity: 0.4,
        }}
      >
        <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8A8278' }}>
          Explore
        </span>
        <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, #F07814, transparent)' }} />
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 1024px) {
          section { padding: 100px 40px 70px !important; }
        }
        @media (max-width: 768px) {
          section { padding: 88px 24px 60px !important; min-height: auto !important; }
          .hero-headline { font-size: clamp(36px, 10vw, 56px) !important; margin-bottom: 32px !important; }
          .hero-sub { font-size: 11px !important; margin-bottom: 12px !important; }
          .poppy-nav {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 16px 8px !important;
            align-items: end !important;
            width: 100% !important;
            max-width: 340px !important;
            margin-bottom: 40px !important;
          }
          .poppy-circle { width: 120px !important; height: 120px !important; }
          .scroll-hint { display: none !important; }
        }
        @media (max-width: 480px) {
          .hero-headline { font-size: clamp(30px, 9vw, 44px) !important; }
          .hero-sub { display: none !important; }
          .poppy-nav { max-width: 300px !important; }
          .poppy-circle { width: 100px !important; height: 100px !important; }
        }
      `}</style>
    </section>
  );
}
