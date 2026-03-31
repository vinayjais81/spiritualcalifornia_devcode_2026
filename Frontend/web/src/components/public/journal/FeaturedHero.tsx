'use client';

import Link from 'next/link';

interface FeaturedHeroProps {
  guideSlug: string;
  postSlug: string;
  title: string;
  excerpt?: string;
  coverImageUrl?: string;
  category?: string;
  authorName: string;
  authorAvatar?: string;
  publishedAt: string;
  readTime?: string;
}

export function FeaturedHero({
  guideSlug, postSlug, title, excerpt, coverImageUrl,
  category, authorName, authorAvatar, publishedAt, readTime,
}: FeaturedHeroProps) {
  return (
    <Link
      href={`/journal/${guideSlug}/${postSlug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: 40 }}
    >
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        borderRadius: 16, overflow: 'hidden', minHeight: 480,
        background: 'linear-gradient(135deg, #2C2420, #3A3530)',
      }}>
        {/* Image */}
        <div style={{ overflow: 'hidden' }}>
          {coverImageUrl ? (
            <img src={coverImageUrl} alt={title} style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transition: 'transform 0.6s',
            }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #3A3530, #2C2420)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 80,
            }}>
              ✦
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{
          padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20, width: 'fit-content',
            background: '#E8B84B', color: '#3A3530',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            ✦ Editor&apos;s Pick
          </div>
          {category && (
            <div style={{
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#E8B84B', marginBottom: 10,
            }}>
              {category}
            </div>
          )}
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 36, fontWeight: 400, color: '#fff', lineHeight: 1.2, marginBottom: 12,
          }}>
            {title}
          </h2>
          {excerpt && (
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20, maxWidth: 420 }}>
              {excerpt}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', border: '2px solid #E8B84B',
              background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: '#E8B84B', overflow: 'hidden',
            }}>
              {authorAvatar ? (
                <img src={authorAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                authorName.split(' ').map(w => w[0]).join('').slice(0, 2)
              )}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{authorName}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {publishedAt}{readTime && ` · ${readTime}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
