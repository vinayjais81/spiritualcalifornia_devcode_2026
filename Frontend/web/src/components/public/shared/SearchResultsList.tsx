'use client';

import Link from 'next/link';
import { CoverImage } from './CoverImage';

/**
 * Generic search-results list used by /events and /travels in their
 * "search active" state. Cards are intentionally simpler than the
 * listing-page cards — search hits don't carry ticket tiers, departures,
 * room types, etc. Users click through to the detail page for the full
 * picture. Same shape works for both events and tours via the `kind`
 * prop and per-row href construction by the caller.
 */
export interface SearchResultRow {
  id: string;
  /** Used in the URL slug or id position. */
  slug?: string;
  title: string;
  /** Short blurb shown under the title. Optional. */
  excerpt?: string | null;
  coverImageUrl: string | null;
  /** Pre-formatted "May 22, 2026" or "Jun 10 → Jun 17" string. */
  dateLabel?: string | null;
  /** Pre-formatted location, e.g. "Los Angeles, CA" or "Nepal". */
  locationLabel?: string | null;
  /** Pre-formatted price string ("From $1,200") or null for free/N/A. */
  priceLabel?: string | null;
  /** Right-side small badge (e.g. "Virtual", "Soul Adventure"). */
  badge?: string | null;
  guide: {
    slug: string;
    displayName: string;
    avatarUrl: string | null;
  };
  /** Final URL the row links to. */
  href: string;
}

export function SearchResultsList({
  rows, query, loading,
}: {
  rows: SearchResultRow[];
  query: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#8A8278', fontSize: 14 }}>
        Searching…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#8A8278' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#3A3530', marginBottom: 8 }}>
          No results for &ldquo;{query}&rdquo;
        </h3>
        <p>Try a different word or check your spelling.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12, color: '#8A8278', letterSpacing: '0.06em' }}>
        {rows.length} result{rows.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </div>
      {rows.map((r) => (
        <Link
          key={r.id}
          href={r.href}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr auto',
              gap: 20,
              background: '#fff',
              border: '1px solid rgba(232,184,75,0.1)',
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(58,53,48,0.1)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <CoverImage src={r.coverImageUrl} alt={r.title} ratio="4 / 3" />

            <div style={{ padding: '16px 4px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 22, fontWeight: 500, color: '#3A3530',
                  margin: 0, lineHeight: 1.25,
                }}
              >
                {r.title}
              </h3>
              {r.excerpt && (
                <p style={{ fontSize: 13, color: '#8A8278', margin: 0, lineHeight: 1.5 }}>
                  {r.excerpt.length > 140 ? r.excerpt.slice(0, 137) + '…' : r.excerpt}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {r.guide.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.guide.avatarUrl}
                    alt=""
                    style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#FDF6E3', color: '#E8B84B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600,
                  }}>
                    {r.guide.displayName.charAt(0)}
                  </div>
                )}
                <span style={{ fontSize: 12, color: '#3A3530' }}>{r.guide.displayName}</span>
                {r.locationLabel && (
                  <span style={{ fontSize: 12, color: '#8A8278' }}>· {r.locationLabel}</span>
                )}
                {r.dateLabel && (
                  <span style={{ fontSize: 12, color: '#8A8278' }}>· {r.dateLabel}</span>
                )}
              </div>
            </div>

            <div style={{
              padding: '16px 20px', display: 'flex', flexDirection: 'column',
              alignItems: 'flex-end', justifyContent: 'space-between',
            }}>
              {r.badge && (
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#E8B84B',
                  background: '#FDF6E3', padding: '4px 10px', borderRadius: 20,
                }}>
                  {r.badge}
                </span>
              )}
              {r.priceLabel && (
                <span style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 20, fontWeight: 500, color: '#3A3530',
                }}>
                  {r.priceLabel}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
