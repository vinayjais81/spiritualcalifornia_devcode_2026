'use client';

import Image from 'next/image';
import Link from 'next/link';

interface UpdateCardProps {
  href?: string;
  image: string;
  imageAlt: string;
  destination: string;
  title: string;
  excerpt: string;
  date: string;
}

export function UpdateCard({
  href = '#',
  image,
  imageAlt,
  destination,
  title,
  excerpt,
  date,
}: UpdateCardProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        width: '280px',
        flex: '0 0 280px',
        background: '#FAFAF7',
        borderRadius: '4px',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.3s, box-shadow 0.3s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow = '0 14px 36px rgba(58,53,48,0.09)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '170px', overflow: 'hidden' }}>
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="280px"
          className="object-cover"
          style={{ filter: 'saturate(0.8)', transition: 'filter 0.4s' }}
        />
      </div>

      <div style={{ padding: '18px 20px 22px' }}>
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#F07820',
            marginBottom: '7px',
          }}
        >
          {destination}
        </div>

        <div
          className="font-cormorant"
          style={{
            fontSize: '18px', fontWeight: 500, lineHeight: 1.3, color: '#3A3530', marginBottom: '7px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '12px', fontWeight: 300, lineHeight: 1.65, color: '#8A8278', marginBottom: '14px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {excerpt}
        </div>

        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '10px',
            color: 'rgba(138,130,120,0.7)',
            letterSpacing: '0.06em',
          }}
        >
          {date}
        </div>
      </div>
    </Link>
  );
}
