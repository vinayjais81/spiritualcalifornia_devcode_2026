'use client';

import Image from 'next/image';
import Link from 'next/link';

interface FeedCardProps {
  href?: string;
  image: string;
  imageAlt: string;
  tag: string;
  tagVariant?: 'default' | 'place' | 'editors';
  title: string;
  excerpt: string;
  avatarImage: string;
  avatarAlt: string;
  metaText: string;
  editorsPick?: boolean;
}

const tagColors: Record<string, string> = {
  default: '#E8B84B',
  place: '#7BAE8A',
  editors: '#F07820',
};

export function FeedCard({
  href = '#',
  image,
  imageAlt,
  tag,
  tagVariant = 'default',
  title,
  excerpt,
  avatarImage,
  avatarAlt,
  metaText,
  editorsPick = false,
}: FeedCardProps) {
  return (
    <Link
      href={href}
      className="group"
      style={{
        // Explicit block + width — the `data-card` wrapper is the flex item
        // inside the Carousel, so the child link needs its own width for the
        // image container (with `fill`) to have something concrete to fill.
        display: 'block',
        width: '300px',
        flex: '0 0 300px',
        background: '#FFFFFF',
        borderRadius: '4px',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        transition: 'transform 0.3s, box-shadow 0.3s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow = '0 16px 40px rgba(58,53,48,0.1)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', width: '100%', height: '200px', overflow: 'hidden' }}>
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="300px"
          className="object-cover"
          style={{ filter: 'saturate(0.85)', transition: 'filter 0.4s' }}
          onMouseEnter={e => ((e.currentTarget as HTMLImageElement).style.filter = 'saturate(1)')}
          onMouseLeave={e => ((e.currentTarget as HTMLImageElement).style.filter = 'saturate(0.85)')}
        />
      </div>

      {/* Editor's Pick badge */}
      {editorsPick && (
        <div
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: '#F07820',
            color: '#FFFFFF',
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '50px',
          }}
        >
          Editor&apos;s Pick
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '20px 22px 24px' }}>
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: tagColors[tagVariant] ?? tagColors.default,
            marginBottom: '8px',
          }}
        >
          {tag}
        </div>

        <div
          className="font-cormorant"
          style={{
            fontSize: '20px', fontWeight: 500, lineHeight: 1.3, color: '#3A3530', marginBottom: '8px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '12px', fontWeight: 300, lineHeight: 1.7, color: '#8A8278', marginBottom: '16px',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {excerpt}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2">
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '1.5px solid #F5D98A',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            <Image src={avatarImage} alt={avatarAlt} fill sizes="28px" className="object-cover" />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '11px',
              fontWeight: 400,
              color: '#8A8278',
            }}
          >
            {metaText}
          </span>
        </div>
      </div>
    </Link>
  );
}
