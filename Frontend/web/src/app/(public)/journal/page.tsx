'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { FeaturedHero } from '@/components/public/journal/FeaturedHero';
import { PostCard } from '@/components/public/journal/PostCard';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  /** Null for editorial articles, which belong to the publication. */
  guide: {
    slug: string;
    displayName: string;
    user: { avatarUrl: string | null };
  } | null;
  authorName?: string | null;
  readTime?: string | null;
}

/** Sentinel for "no category filter". Never sent to the API. */
const ALL_TAB = 'All';

interface CategoryTab {
  label: string;
  count: number;
}

interface TopicChip {
  tag: string;
  count: number;
}

/**
 * Articles per page. The API clamps `limit` to 50 (see BlogController), so this
 * must stay at or below that — a larger value is silently reduced, which would
 * make totalPages disagree with what actually arrives.
 */
const PAGE_SIZE = 24;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Maps a /search/blog hit (flat guide fields) to the nested BlogPost shape
// the page's components expect. Keeps PostCard / FeaturedHero unchanged.
function adaptSearchHit(hit: any): BlogPost {
  return {
    id: hit.id,
    title: hit.title,
    slug: hit.slug,
    excerpt: hit.excerpt,
    coverImageUrl: hit.coverImageUrl,
    tags: hit.tags ?? [],
    publishedAt: hit.publishedAt,
    // Editorial hits come back with no guide (the FTS query LEFT JOINs), and
    // guideName is COALESCEd to the editorial byline. Returning a half-built
    // guide object with a null slug would produce a link to /guides/null.
    guide: hit.guideSlug
      ? {
          slug: hit.guideSlug,
          displayName: hit.guideName,
          user: { avatarUrl: hit.guideAvatarUrl },
        }
      : null,
    authorName: hit.guideName ?? null,
  };
}

export default function JournalPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [activeFilter, setActiveFilter] = useState(ALL_TAB);
  // Tabs come from the API rather than a literal, so they always describe what
  // is actually published.
  const [tabs, setTabs] = useState<CategoryTab[]>([]);
  // Topic chips, aggregated server-side across the whole library. Deriving
  // them from `posts` described only the page on screen and reshuffled on
  // every search.
  const [topics, setTopics] = useState<TopicChip[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  // Pagination for the default listing. The library is 124 articles and
  // growing, so "latest posts" has to be a page of results rather than all of
  // them — but Load More was previously a button with no handler, which meant
  // the listing silently capped at the first page.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Tab list is independent of the current filter/search, so it is fetched once
  // and not refetched as the user narrows down — otherwise the tabs would
  // vanish as soon as you selected one.
  useEffect(() => {
    api
      .get('/blog/categories')
      .then((res) => {
        setTabs(res.data?.categories ?? []);
        setTopics(res.data?.topics ?? []);
      })
      .catch(() => {
        setTabs([]);
        setTopics([]);
      });
  }, []);

  // Debounce the search input so we don't fire a request on every keystroke.
  // 250ms is the standard sweet-spot — perceptibly instant on fast typers,
  // not so fast that it floods the API on backspace-rewrite-backspace cycles.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const q = searchQuery.trim();
    const handle = setTimeout(async () => {
      try {
        // Tab, chip and query all narrow both paths, so they compose rather
        // than one silently overriding the others.
        const category = activeFilter === ALL_TAB ? undefined : activeFilter;
        const tag = activeTag ?? undefined;

        if (q.length > 0) {
          // Server-side FTS — typo-tolerant via pg_trgm.
          const res = await api.get('/search/blog', { params: { q, page: 0, category, tag } });
          const hits = (res.data?.hits ?? []) as any[];
          if (!cancelled) setPosts(hits.map(adaptSearchHit));
        } else {
          // No query → default "latest posts" listing, first page.
          const res = await api.get('/blog', { params: { page: 1, limit: PAGE_SIZE, category, tag } });
          if (!cancelled) {
            setPosts(res.data?.posts ?? []);
            setPage(1);
            setTotalPages(res.data?.pagination?.totalPages ?? 1);
          }
        }
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q.length > 0 ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchQuery, activeFilter, activeTag]);

  const featured = posts[0];
  const remaining = posts.slice(1);

  /**
   * Append the next page. Only offered for the unfiltered listing — search
   * results come from a different endpoint with its own paging, and mixing the
   * two would append FTS hits onto a chronological list.
   */
  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      // Must carry the active narrowing, or page 2 would silently widen back to
      // every article while the tab and chip still read as selected.
      const res = await api.get('/blog', {
        params: {
          page: next,
          limit: PAGE_SIZE,
          category: activeFilter === ALL_TAB ? undefined : activeFilter,
          tag: activeTag ?? undefined,
        },
      });
      const incoming: BlogPost[] = res.data?.posts ?? [];
      // Guard against duplicates: sortOrder ties could otherwise let a row
      // appear on two pages.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...incoming.filter((p) => !seen.has(p.id))];
      });
      setPage(next);
      setTotalPages(res.data?.pagination?.totalPages ?? totalPages);
    } catch {
      toast.error('Could not load more articles — please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const canLoadMore = !searchQuery.trim() && page < totalPages;

  return (
    <>
      {/* Page Hero */}
      <div style={{
        textAlign: 'center', padding: '72px clamp(16px, 5vw, 48px) 48px',
        background: 'linear-gradient(180deg, #fff 0%, #F5F2EB 100%)',
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#F07814', marginBottom: 12,
        }}>
          ✦ The Journal
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 400, color: '#3A3530', lineHeight: 1.15, marginBottom: 10,
        }}>
          Stories, Practices &amp; Wisdom
        </h1>
        <p style={{ fontSize: 15, color: '#8A8278', maxWidth: 520, margin: '0 auto' }}>
          Explorations in consciousness, healing, and the spiritual path — from our editorial team and our verified practitioners.
        </p>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid rgba(240,120,20,0.1)',
        position: 'sticky', top: 69, zIndex: 90,
        padding: '0 clamp(12px, 4vw, 48px)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div className="scrollbar-none" style={{ display: 'flex', gap: 0, overflowX: 'auto', maxWidth: '100%' }}>
            {[{ label: ALL_TAB, count: 0 }, ...tabs].map(({ label: tab, count }) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                title={count ? `${count} article${count === 1 ? '' : 's'}` : undefined}
                style={{
                  padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer',
                  flexShrink: 0, whiteSpace: 'nowrap',
                  fontSize: 12, letterSpacing: '0.06em',
                  fontWeight: activeFilter === tab ? 600 : 400,
                  color: activeFilter === tab ? '#3A3530' : '#8A8278',
                  borderBottom: activeFilter === tab ? '2px solid #F07814' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="sc-grow-md" style={{ position: 'relative' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="sc-w-full-md"
              style={{
                padding: '9px 16px 9px 36px', borderRadius: 24,
                background: '#F5F2EB', border: '1px solid rgba(240,120,20,0.15)',
                fontSize: 12, color: '#3A3530', outline: 'none', width: 200,
              }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#8A8278' }}>
              🔍
            </span>
          </div>
        </div>
      </div>

      {/* Topics */}
      {topics.length > 0 && (
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '20px clamp(12px, 4vw, 48px)',
          display: 'flex', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: '#8A8278', alignSelf: 'center', marginRight: 8 }}>Browse:</span>
          {topics.map(({ tag, count }) => {
            const on = activeTag === tag;
            return (
              <button
                key={tag}
                // Clicking an active chip clears it, so the filter can be
                // undone without hunting for a reset control.
                onClick={() => setActiveTag(on ? null : tag)}
                title={`${count} article${count === 1 ? '' : 's'}`}
                style={{
                  padding: '6px 14px', borderRadius: 20,
                  background: on ? '#F07814' : '#FEF7F0',
                  border: `1px solid ${on ? '#F07814' : 'rgba(240,120,20,0.2)'}`,
                  fontSize: 12, color: on ? '#fff' : '#3A3530', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tag}
              </button>
            );
          })}
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              style={{
                padding: '6px 12px', borderRadius: 20, background: 'none', border: 'none',
                fontSize: 12, color: '#8A8278', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Main Body */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px clamp(12px, 4vw, 48px) 80px' }}>

        {/* Section Label */}
        <div style={{
          fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#F07814', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          Featured
          <span style={{ flex: 1, height: 1, background: 'rgba(240,120,20,0.25)' }} />
        </div>

        {/* Featured Hero */}
        {featured && (
          <FeaturedHero
            postSlug={featured.slug}
            title={featured.title}
            excerpt={featured.excerpt || undefined}
            coverImageUrl={featured.coverImageUrl || undefined}
            category={featured.tags[0]}
            authorName={featured.guide?.displayName ?? featured.authorName ?? 'Spiritual California'}
            authorAvatar={featured.guide?.user.avatarUrl || undefined}
            publishedAt={featured.publishedAt ? formatDate(featured.publishedAt) : ''}
            readTime={featured.readTime ?? '8 min read'}
          />
        )}

        {/* Latest Posts */}
        <div style={{
          fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#F07814', marginBottom: 24, marginTop: 40,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          Latest Posts
          <span style={{ flex: 1, height: 1, background: 'rgba(240,120,20,0.25)' }} />
        </div>

        {loading ? (
          <div className="sc-cards-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(240,120,20,0.1)' }}>
                <div style={{ height: 190, background: '#FEF7F0' }} />
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ height: 12, background: '#f0eeeb', borderRadius: 4, width: '40%', marginBottom: 10 }} />
                  <div style={{ height: 18, background: '#f0eeeb', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 12, background: '#f0eeeb', borderRadius: 4, width: '70%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: '#FEF7F0', border: '1px solid rgba(240,120,20,0.2)', borderRadius: 16,
            color: '#8A8278', fontSize: 14,
          }}>
            No articles yet. Check back soon — new writing lands here from our editorial team and our verified practitioners.
          </div>
        ) : (
          <div className="sc-cards-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
            {remaining.map((post) => (
              <PostCard
                key={post.id}
                postSlug={post.slug}
                title={post.title}
                excerpt={post.excerpt || undefined}
                coverImageUrl={post.coverImageUrl || undefined}
                category={post.tags[0]}
                authorName={post.guide?.displayName ?? post.authorName ?? 'Spiritual California'}
                authorAvatar={post.guide?.user.avatarUrl || undefined}
                publishedAt={post.publishedAt ? formatDate(post.publishedAt) : ''}
                readTime={post.readTime ?? '5 min read'}
              />
            ))}
          </div>
        )}

        {/* Load more — hidden once everything is on screen. */}
        {canLoadMore && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                padding: '14px 32px', borderRadius: 8,
                background: 'transparent', border: '1.5px solid rgba(240,120,20,0.3)',
                fontFamily: "'Inter', sans-serif",
                fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: '#3A3530', cursor: loadingMore ? 'default' : 'pointer',
                opacity: loadingMore ? 0.6 : 1,
              }}
            >
              {loadingMore ? 'Loading…' : 'Load More Articles'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
