'use client';

import { useState } from 'react';

interface ImageGalleryProps {
  images: string[];
  alt: string;
  badges?: string[];
}

export function ImageGallery({ images, alt, badges }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = images.length > 0;

  return (
    <div style={{ position: 'sticky', top: 90 }}>
      {/* Main image */}
      <div style={{
        position: 'relative', borderRadius: 16, overflow: 'hidden',
        background: '#1a1714', aspectRatio: '1/1', marginBottom: hasImages && images.length > 1 ? 12 : 0,
        cursor: 'zoom-in',
      }}>
        {hasImages ? (
          <img
            src={images[activeIndex]}
            alt={alt}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 80, background: 'linear-gradient(135deg, #2C2420, #3A3530)',
          }}>
            📦
          </div>
        )}

        {/* Badges */}
        {badges && badges.length > 0 && (
          <>
            {badges[0] && (
              <span style={{
                position: 'absolute', top: 20, left: 20,
                padding: '6px 14px', borderRadius: 20,
                background: '#3A3530', color: '#E8B84B',
                fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {badges[0]}
              </span>
            )}
            {badges[1] && (
              <span style={{
                position: 'absolute', top: 20, right: 20,
                padding: '6px 14px', borderRadius: 20,
                background: '#E8B84B', color: '#3A3530',
                fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {badges[1]}
              </span>
            )}
          </>
        )}
      </div>

      {/* Thumbnails */}
      {hasImages && images.length > 1 && (
        <div style={{ display: 'flex', gap: 10 }}>
          {images.slice(0, 4).map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{
                flex: 1, aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden',
                border: activeIndex === i ? '2px solid #E8B84B' : '2px solid transparent',
                cursor: 'pointer', background: '#1a1714', padding: 0,
              }}
            >
              <img src={img} alt={`${alt} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
