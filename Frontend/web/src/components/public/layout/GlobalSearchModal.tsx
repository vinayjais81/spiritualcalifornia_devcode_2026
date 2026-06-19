'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * Global cross-entity search modal. Triggered by the magnifying-glass
 * icon in the navbar. Hits `GET /search?q=…` and renders top-5 results
 * per entity (Practitioners, Products, Events, Tours, Journal).
 *
 * Each result row links to its detail page and closes the modal on click.
 * ESC and backdrop-click also close. Input autofocuses on open.
 */

// Each entity's hit shape from /search returns the flat fields shown in
// PostgresSearchService — kept loose with `any` here because the modal
// only reads a handful of fields per kind, and the underlying SQL types
// already constrain the shape server-side.
interface SearchAllResponse {
  guides?: Array<any>;
  products?: Array<any>;
  events?: Array<any>;
  tours?: Array<any>;
  blog?: Array<any>;
}

function formatPrice(p: any): string | null {
  if (p === null || p === undefined) return null;
  const n = typeof p === 'string' ? parseFloat(p) : Number(p);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return 'Free';
  return `$${n.toLocaleString()}`;
}

export function GlobalSearchModal({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchAllResponse>({});
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Autofocus when opened. Reset state on close so the modal opens
  // fresh next time (no stale results from the last search session).
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({});
    }
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Debounced fetch from /search?q=
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length === 0) {
      setResults({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.get('/search', { params: { q } });
        if (!cancelled) setResults(res.data ?? {});
      } catch {
        if (!cancelled) setResults({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, open]);

  if (!open) return null;

  const guides = results.guides ?? [];
  const products = results.products ?? [];
  const events = results.events ?? [];
  const tours = results.tours ?? [];
  const blog = results.blog ?? [];
  const totalResults = guides.length + products.length + events.length + tours.length + blog.length;
  const hasQuery = query.trim().length > 0;

  // Wraps every result-row click: navigate, then close. Using router so the
  // body-scroll-lock cleanup runs (a plain Link would still close via the
  // open=false effect but feel less responsive).
  const goTo = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(30, 26, 23, 0.55)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '80px 20px 20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 720,
          maxHeight: 'calc(100vh - 100px)',
          display: 'flex', flexDirection: 'column',
          background: '#fff', borderRadius: 16,
          boxShadow: '0 20px 80px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px', borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
          <span style={{ fontSize: 18, color: '#8A8278' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search practitioners, products, events, journeys, journal…"
            aria-label="Search the marketplace"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, color: '#3A3530', background: 'transparent',
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#8A8278', padding: '4px 8px',
            }}
          >
            ESC
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', padding: '20px 24px 24px' }}>
          {!hasQuery && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#8A8278', fontSize: 14 }}>
              Start typing to search across practitioners, products, events, soul journeys, and the journal.
            </div>
          )}

          {hasQuery && loading && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#8A8278', fontSize: 13 }}>
              Searching…
            </div>
          )}

          {hasQuery && !loading && totalResults === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#8A8278' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <p style={{ fontSize: 14 }}>No matches for &ldquo;{query.trim()}&rdquo;.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Try a different word or check spelling.</p>
            </div>
          )}

          {hasQuery && !loading && totalResults > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {guides.length > 0 && (
                <Section title="Practitioners" linkHref={`/practitioners`}>
                  {guides.map((g) => (
                    <ResultRow
                      key={g.id}
                      imageUrl={g.avatarUrl}
                      circleImage
                      title={g.displayName}
                      subtitle={g.tagline}
                      onClick={() => goTo(`/guides/${g.slug}`)}
                    />
                  ))}
                </Section>
              )}
              {products.length > 0 && (
                <Section title="Shop" linkHref="/shop">
                  {products.map((p) => (
                    <ResultRow
                      key={p.id}
                      imageUrl={p.imageUrl}
                      title={p.name}
                      subtitle={`${p.guideName} · ${formatPrice(p.price) ?? '—'}`}
                      onClick={() => goTo(`/shop/${p.id}`)}
                    />
                  ))}
                </Section>
              )}
              {events.length > 0 && (
                <Section title="Events" linkHref="/events">
                  {events.map((e) => (
                    <ResultRow
                      key={e.id}
                      imageUrl={e.coverImageUrl}
                      title={e.title}
                      subtitle={`${e.guideName}${e.location ? ` · ${e.location}` : ''}`}
                      onClick={() => goTo(`/events/${e.id}`)}
                    />
                  ))}
                </Section>
              )}
              {tours.length > 0 && (
                <Section title="Soul Travels" linkHref="/travels">
                  {tours.map((t) => (
                    <ResultRow
                      key={t.id}
                      imageUrl={t.coverImageUrl}
                      title={t.title}
                      subtitle={`${t.guideName}${t.country ? ` · ${t.country}` : ''}`}
                      onClick={() => goTo(`/tours/${t.slug}`)}
                    />
                  ))}
                </Section>
              )}
              {blog.length > 0 && (
                <Section title="Journal" linkHref="/journal">
                  {blog.map((b) => (
                    <ResultRow
                      key={b.id}
                      imageUrl={b.coverImageUrl}
                      title={b.title}
                      subtitle={`by ${b.guideName}`}
                      onClick={() => goTo(`/journal/${b.guideSlug}/${b.slug}`)}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, linkHref, children }: { title: string; linkHref: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <h3 style={{
          fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: '#8A8278', margin: 0, fontWeight: 600,
        }}>{title}</h3>
        <Link
          href={linkHref}
          style={{
            fontSize: 11, color: '#F07814', textDecoration: 'none',
            letterSpacing: '0.06em',
          }}
        >
          View all →
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function ResultRow({
  imageUrl, title, subtitle, circleImage, onClick,
}: {
  imageUrl: string | null | undefined;
  title: string;
  subtitle?: string | null;
  circleImage?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
        background: 'transparent', border: 'none', width: '100%',
        textAlign: 'left', transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F2EB'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{
            width: 40, height: 40, flexShrink: 0,
            borderRadius: circleImage ? '50%' : 6,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{
          width: 40, height: 40, flexShrink: 0,
          borderRadius: circleImage ? '50%' : 6,
          background: '#FEF7F0', color: '#F07814',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600,
        }}>{title.charAt(0)}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: '#3A3530', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontSize: 12, color: '#8A8278', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{subtitle}</div>
        )}
      </div>
    </button>
  );
}
