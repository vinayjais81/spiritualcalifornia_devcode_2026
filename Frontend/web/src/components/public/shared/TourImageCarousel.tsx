'use client';

import { useState } from 'react';

interface Props {
  images: string[];
  alt: string;
  countryFlag?: string;   // e.g. '🇳🇵'
  countryName?: string;   // e.g. 'Nepal'
  priceFrom?: number;     // Displayed in the gold chip
  minHeight?: number;     // px — default 420
}

/**
 * Matches the soul-travels.html design carousel:
 * - Slide-based fade/slide transition with arrows + dots
 * - Top-left country badge (flag + name)
 * - Bottom-right gold "From $X" chip
 */
export function TourImageCarousel({
  images,
  alt,
  countryFlag,
  countryName,
  priceFrom,
  minHeight = 420,
}: Props) {
  const [current, setCurrent] = useState(0);
  const slides = images.length > 0 ? images : ['/images/hero3.jpg'];
  const total = slides.length;
  const go = (idx: number) => setCurrent((idx + total) % total);

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight }}>
      {/* Track */}
      <div
        style={{
          display: 'flex',
          height: '100%',
          transition: 'transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)',
          transform: `translateX(-${current * 100}%)`,
        }}
      >
        {slides.map((src, i) => (
          <div key={i} style={{ minWidth: '100%', height: '100%', flexShrink: 0 }}>
            <img
              src={src}
              alt={alt}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                minHeight,
              }}
            />
          </div>
        ))}
      </div>

      {/* Prev / Next */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(current - 1); }}
            style={btnStyle('left')}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(current + 1); }}
            style={btnStyle('right')}
            aria-label="Next image"
          >
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {total > 1 && (
        <div
          style={{
            position: 'absolute', bottom: 14, left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: 6, zIndex: 3,
          }}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(i); }}
              style={{
                width: i === current ? 18 : 6,
                height: 6,
                borderRadius: i === current ? 3 : '50%',
                background: i === current ? '#E8B84B' : 'rgba(255,255,255,0.4)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Country badge (top-left) */}
      {(countryFlag || countryName) && (
        <div
          style={{
            position: 'absolute', top: 18, left: 18, zIndex: 3,
            background: 'rgba(30,26,23,0.82)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(232,184,75,0.3)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {countryFlag && <span style={{ fontSize: 20 }}>{countryFlag}</span>}
          {countryName && (
            <span style={{
              fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.85)',
            }}>{countryName}</span>
          )}
        </div>
      )}

      {/* Price badge (bottom-right) */}
      {typeof priceFrom === 'number' && (
        <div style={{
          position: 'absolute', bottom: 18, right: 18, zIndex: 3,
          background: '#E8B84B', borderRadius: 12, padding: '10px 18px',
        }}>
          <div style={{
            fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(44,36,32,0.7)',
          }}>From</div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24, fontWeight: 600, color: '#3A3530', lineHeight: 1,
          }}>
            ${priceFrom.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 14,
    transform: 'translateY(-50%)',
    width: 40, height: 40, borderRadius: '50%',
    background: 'rgba(30,26,23,0.7)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(232,184,75,0.3)',
    color: '#fff',
    fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
    zIndex: 3,
  };
}
