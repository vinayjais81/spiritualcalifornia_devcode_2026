'use client';

import { useRef } from 'react';

interface CarouselProps {
  id: string;
  children: React.ReactNode;
  scrollAmount?: number;
}

export function Carousel({ id, children, scrollAmount = 2 }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  function scroll(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>('[data-card]');
    const cardWidth = card ? card.offsetWidth + 24 : 300;
    track.scrollBy({ left: dir * cardWidth * scrollAmount, behavior: 'smooth' });
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      const track = trackRef.current;
      if (!track) return;
      const card = track.querySelector<HTMLElement>('[data-card]');
      const cardWidth = card ? card.offsetWidth + 24 : 300;
      track.scrollBy({ left: diff > 0 ? cardWidth : -cardWidth, behavior: 'smooth' });
    }
  }

  const btnStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: '#FFFFFF',
    border: '1.5px solid rgba(232,184,75,0.5)',
    color: '#3A3530',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    boxShadow: '0 4px 16px rgba(58,53,48,0.1)',
    transition: 'background 0.3s, border-color 0.3s, transform 0.2s',
  };

  return (
    <div style={{ position: 'relative', padding: '0 60px' }}>
      <button
        aria-label="Previous"
        style={{ ...btnStyle, left: '12px' }}
        onClick={() => scroll(-1)}
        onMouseEnter={e => {
          const el = e.currentTarget;
          el.style.background = '#E8B84B';
          el.style.borderColor = '#E8B84B';
          el.style.color = '#FFFFFF';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget;
          el.style.background = '#FFFFFF';
          el.style.borderColor = 'rgba(232,184,75,0.5)';
          el.style.color = '#3A3530';
        }}
      >
        ←
      </button>

      <div
        id={id}
        ref={trackRef}
        className="scrollbar-none"
        style={{ display: 'flex', gap: '24px', overflowX: 'auto', scrollBehavior: 'smooth', paddingBottom: '8px' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>

      <button
        aria-label="Next"
        style={{ ...btnStyle, right: '12px' }}
        onClick={() => scroll(1)}
        onMouseEnter={e => {
          const el = e.currentTarget;
          el.style.background = '#E8B84B';
          el.style.borderColor = '#E8B84B';
          el.style.color = '#FFFFFF';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget;
          el.style.background = '#FFFFFF';
          el.style.borderColor = 'rgba(232,184,75,0.5)';
          el.style.color = '#3A3530';
        }}
      >
        →
      </button>
    </div>
  );
}
