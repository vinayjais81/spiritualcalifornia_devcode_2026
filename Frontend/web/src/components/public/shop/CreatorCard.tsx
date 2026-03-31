'use client';

import Link from 'next/link';

interface CreatorCardProps {
  slug: string;
  displayName: string;
  tagline?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  compact?: boolean;
}

export function CreatorCard({ slug, displayName, tagline, avatarUrl, isVerified, compact }: CreatorCardProps) {
  const padding = compact ? '16px' : '20px 24px';
  const avatarSize = compact ? 48 : 56;
  const bg = compact ? 'rgba(232,184,75,0.03)' : '#fff';

  return (
    <Link href={`/guides/${slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: compact ? 14 : 16,
        padding, background: bg,
        border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12,
        transition: 'border-color 0.3s', cursor: 'pointer',
      }}>
        <div style={{
          width: avatarSize, height: avatarSize, borderRadius: '50%',
          border: '2px solid #E8B84B', overflow: 'hidden', flexShrink: 0,
          background: '#FDF6E3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: avatarSize * 0.4, fontWeight: 600, color: '#E8B84B' }}>
              {displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: compact ? 16 : 18, fontWeight: 500, color: '#3A3530',
          }}>
            {displayName}
            {isVerified && <span style={{ marginLeft: 6, fontSize: 14 }} title="Verified">✓</span>}
          </div>
          {tagline && (
            <div style={{ fontSize: 12, color: '#8A8278', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tagline}
            </div>
          )}
        </div>
        <span style={{ fontSize: 18, color: '#8A8278', flexShrink: 0 }}>→</span>
      </div>
    </Link>
  );
}
