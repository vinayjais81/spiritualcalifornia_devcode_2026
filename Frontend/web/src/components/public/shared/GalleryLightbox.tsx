'use client';

import { useEffect, useState } from 'react';

/**
 * Full-screen image lightbox with keyboard + thumbnail navigation.
 *
 * Used by the tour detail page (and reusable for any other gallery
 * surface). Caller controls open/close + the initial index; the
 * lightbox owns the per-image cursor while it's open.
 *
 * Keyboard:
 *   - Esc: close
 *   - ← / →: previous / next image
 */
export function GalleryLightbox({
  images, initialIndex, alt, onClose,
}: {
  images: string[];
  /** null = closed, number = open at this index. */
  initialIndex: number | null;
  alt: string;
  onClose: () => void;
}) {
  const open = initialIndex !== null;
  const [index, setIndex] = useState(0);

  // Seed cursor each time the lightbox opens.
  useEffect(() => {
    if (initialIndex !== null) setIndex(initialIndex);
  }, [initialIndex]);

  // Body scroll lock + keyboard shortcuts.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, images.length, onClose]);

  if (!open || images.length === 0) return null;

  const total = images.length;
  const safeIndex = Math.min(Math.max(index, 0), total - 1);
  const src = images[safeIndex];

  const go = (delta: number) =>
    setIndex((i) => (i + delta + total) % total);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(20, 17, 14, 0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 80px 100px',
      }}
    >
      {/* Top-right close */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close gallery"
        style={{
          position: 'absolute', top: 20, right: 24,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', border: 'none',
          color: '#fff', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {/* Image counter */}
      <div style={{
        position: 'absolute', top: 28, left: 28,
        color: 'rgba(255,255,255,0.7)', fontSize: 13,
        letterSpacing: '0.1em',
      }}>
        {safeIndex + 1} / {total}
      </div>

      {/* Main image */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: '100%', maxHeight: 'calc(100vh - 200px)',
            objectFit: 'contain', borderRadius: 8,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* Prev / Next */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            aria-label="Previous image"
            style={{
              position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)',
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: '#fff', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            aria-label="Next image"
            style={{
              position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: '#fff', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Thumbnail strip — only when 2+ images. */}
      {total > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 8, padding: 8,
            background: 'rgba(0,0,0,0.4)', borderRadius: 12,
            maxWidth: '90vw', overflowX: 'auto',
          }}
        >
          {images.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              style={{
                flex: '0 0 auto',
                width: 60, height: 44, padding: 0,
                borderRadius: 4, overflow: 'hidden',
                border: i === safeIndex ? '2px solid #F07814' : '2px solid transparent',
                background: 'none', cursor: 'pointer',
                opacity: i === safeIndex ? 1 : 0.6,
                transition: 'opacity 0.15s, border-color 0.15s',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
