'use client';

import { CSSProperties } from 'react';

interface Props {
  src: string | null | undefined;
  alt: string;
  /**
   * Aspect ratio as a CSS aspect-ratio string. Defaults to '16 / 9' which
   * matches the event/tour landscape design. Use '4 / 3' for hero panels,
   * '1 / 1' for square thumbnails, '3 / 1' for banners.
   */
  ratio?: string;
  /** Fallback image when src is null/empty (e.g. '/images/hero3.jpg'). */
  fallback?: string;
  /** Optional extra styles for the outer wrapper. */
  style?: CSSProperties;
  /** Render the wrapper with extra class names. */
  className?: string;
  /**
   * Where to focus the crop when the source doesn't match the box ratio.
   * Defaults to 'center'. Use '50% 30%' to bias toward the upper third
   * (good for portrait shots of people — keeps faces in frame).
   */
  position?: string;
  /** Optional rounded corners on the wrapper. */
  borderRadius?: number | string;
}

/**
 * Renders a cover image inside a fixed-aspect-ratio box. The image is
 * cropped (object-fit: cover) to fill the box without distorting its
 * proportions or breaking the parent layout — irrespective of how tall
 * or wide the original upload was.
 *
 * Why this exists: guides upload images at unpredictable dimensions
 * (phone portraits, scans, etc.). Without a fixed aspect-ratio container
 * the source image dictates the card's height, which breaks listing
 * grids visually. See docs/cover-image-policy.md.
 */
export function CoverImage({
  src,
  alt,
  ratio = '16 / 9',
  fallback,
  style,
  className,
  position = 'center',
  borderRadius,
}: Props) {
  const url = src && src.trim().length > 0 ? src : fallback;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: ratio,
        overflow: 'hidden',
        background: '#F5EFE0',
        borderRadius,
        ...style,
      }}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: position,
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(58,53,48,0.25)',
            fontSize: 36,
          }}
        >
          ✦
        </div>
      )}
    </div>
  );
}
