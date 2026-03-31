'use client';

import Link from 'next/link';

interface SectionHeaderProps {
  title: string;
  linkLabel?: string;
  linkHref?: string;
}

export function SectionHeader({ title, linkLabel, linkHref = '#' }: SectionHeaderProps) {
  return (
    <div
      style={{ padding: '0 60px', marginBottom: '36px' }}
      className="flex items-center gap-5"
    >
      {/* Left rule */}
      <div
        className="flex-1 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(232,184,75,0.3), transparent)' }}
      />

      <h2
        className="font-cormorant whitespace-nowrap"
        style={{ fontSize: '30px', fontWeight: 400, fontStyle: 'italic', color: '#3A3530' }}
      >
        {title}
      </h2>

      {/* Right rule */}
      <div
        className="flex-1 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(232,184,75,0.3), transparent)' }}
      />

      {linkLabel && (
        <Link
          href={linkHref}
          className="whitespace-nowrap transition-colors duration-300"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8A8278',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(138,130,120,0.4)',
            paddingBottom: '1px',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.color = '#E8B84B';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = '#E8B84B';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.color = '#8A8278';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(138,130,120,0.4)';
          }}
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
