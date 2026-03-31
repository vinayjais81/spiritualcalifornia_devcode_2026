'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PostCardProps {
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
  featured?: boolean;
}

export function PostCard({
  guideSlug, postSlug, title, excerpt, coverImageUrl,
  category, authorName, authorAvatar, publishedAt, readTime, featured,
}: PostCardProps) {
  const [hovered, setHovered] = useState(false);
  const imageHeight = featured ? 220 : 190;

  return (
    <Link
      href={`/journal/${guideSlug}/${postSlug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: '#fff', border: '1px solid rgba(232,184,75,0.1)',
        borderRadius: 12, overflow: 'hidden',
        transition: 'box-shadow 0.3s, transform 0.3s',
        boxShadow: hovered ? '0 8px 32px rgba(232,184,75,0.12)' : 'none',
        transform: hovered ? 'translateY(-3px)' : 'none',
      }}>
        {/* Image */}
        <div style={{ overflow: 'hidden', height: imageHeight, background: '#FDF6E3' }}>
          {coverImageUrl ? (
            <img src={coverImageUrl} alt={title} style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transition: 'transform 0.5s',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
            }} />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 48, background: 'linear-gradient(135deg, #FDF6E3, #F5D98A)',
            }}>
              ✦
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px' }}>
          {category && (
            <div style={{
              fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#E8B84B', marginBottom: 8,
            }}>
              {category}
            </div>
          )}
          <h3 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: featured ? 22 : 20, fontWeight: 500, color: '#3A3530',
            lineHeight: 1.3, marginBottom: 8,
          }}>
            {title}
          </h3>
          {excerpt && (
            <p style={{
              fontSize: 13, color: '#8A8278', lineHeight: 1.6, marginBottom: 12,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
            }}>
              {excerpt}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E8B84B',
              background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: '#E8B84B', overflow: 'hidden', flexShrink: 0,
            }}>
              {authorAvatar ? (
                <img src={authorAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                authorName.split(' ').map(w => w[0]).join('').slice(0, 2)
              )}
            </div>
            <span style={{ fontSize: 12, color: '#3A3530', fontWeight: 500 }}>{authorName}</span>
            <span style={{ fontSize: 11, color: '#8A8278' }}>·</span>
            <span style={{ fontSize: 11, color: '#8A8278' }}>{publishedAt}</span>
            {readTime && (
              <>
                <span style={{ fontSize: 11, color: '#8A8278' }}>·</span>
                <span style={{ fontSize: 11, color: '#8A8278' }}>{readTime}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
