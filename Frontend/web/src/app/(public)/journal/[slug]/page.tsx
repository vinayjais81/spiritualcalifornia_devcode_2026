'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { renderArticleBody, estimateReadTime } from '@/lib/articleContent';
import { useAuthStore } from '@/store/auth.store';
import { ReadingProgressBar } from '@/components/public/journal/ReadingProgressBar';
import { AuthorBioCard } from '@/components/public/journal/AuthorBioCard';
import { PostCard } from '@/components/public/journal/PostCard';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  applauseCount: number;
  /**
   * Null for editorial articles, which belong to the publication rather than to
   * a practitioner. Everything guide-shaped on this page — the bio card, the
   * follow button, the author link — has to tolerate that.
   */
  guide: {
    id: string;
    slug: string;
    displayName: string;
    tagline: string | null;
    bio: string | null;
    user: { avatarUrl: string | null };
  } | null;
  // Editorial fields; absent on practitioner posts.
  contentFormat?: 'HTML' | 'MARKDOWN' | null;
  authorName?: string | null;
  authorRole?: string | null;
  dek?: string | null;
  readTime?: string | null;
  heroAlt?: string | null;
  categoryLabel?: string | null;
  healthAdjacent?: boolean;
  // evidenceTier is deliberately absent — the API strips it. It must never
  // render. See docs/journal-content-library-strategy.md.
}

interface RelatedPostApi {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  tags: string[];
  // Nullable for the same reason as BlogPost.guide above. Declaring it
  // non-null hid a crash from the compiler: every editorial article threw on
  // `rp.guide.slug` while the types looked fine.
  guide: { slug: string; displayName: string } | null;
  authorName?: string | null;
  readTime?: string | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function SinglePostPage() {
  const params = useParams();
  // Flat routing: /journal/{slug}, no author segment. Slugs are globally
  // unique so editorial and practitioner posts share one address space.
  const postSlug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<RelatedPostApi[]>([]);

  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Applause (clap) — count + per-device dedupe via localStorage.
  const [applause, setApplause] = useState(0);
  const [hasApplauded, setHasApplauded] = useState(false);
  // Follow state for the post's author.
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await api.get(`/blog/${postSlug}`);
        setPost(res.data);
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postSlug]);

  // Related posts: best-effort, silently empty if the endpoint isn't live.
  useEffect(() => {
    if (!post) return;
    (async () => {
      try {
        const res = await api.get('/blog', { params: { limit: 4, excludeId: post.id } });
        const items: RelatedPostApi[] = res.data?.posts ?? [];
        setRelated(items.filter((p) => p.id !== post.id).slice(0, 3));
      } catch {
        setRelated([]);
      }
    })();
  }, [post]);

  // Seed applause count + per-device "already applauded" flag when the post loads.
  useEffect(() => {
    if (!post) return;
    setApplause(post.applauseCount ?? 0);
    try {
      setHasApplauded(localStorage.getItem(`sc-applauded-${post.id}`) === '1');
    } catch { /* localStorage unavailable — treat as not applauded */ }
  }, [post]);

  // Load the current user's follow state for this guide (signed-in only).
  useEffect(() => {
    // Editorial articles have no practitioner to follow.
    if (!post?.guide || !isAuthenticated) { setFollowing(false); return; }
    api.get(`/guides/${post.guide.id}/follow-status`)
      .then((r) => setFollowing(!!r.data?.isFollowing))
      .catch(() => { /* non-critical */ });
  }, [post, isAuthenticated]);

  const handleApplaud = async () => {
    if (!post || hasApplauded) return;
    // Optimistic: bump immediately, persist the dedupe flag, reconcile with
    // the server's authoritative count on success; revert on failure.
    setApplause((c) => c + 1);
    setHasApplauded(true);
    try { localStorage.setItem(`sc-applauded-${post.id}`, '1'); } catch { /* ignore */ }
    try {
      const r = await api.post(`/blog/${post.id}/applaud`);
      if (typeof r.data?.applauseCount === 'number') setApplause(r.data.applauseCount);
    } catch {
      setApplause((c) => Math.max(0, c - 1));
      setHasApplauded(false);
      try { localStorage.removeItem(`sc-applauded-${post.id}`); } catch { /* ignore */ }
      toast.error('Could not applaud — please try again.');
    }
  };

  const handleFollow = async () => {
    if (!post?.guide) return;
    if (!isAuthenticated) {
      toast.error('Sign in to follow this practitioner.');
      router.push(`/signin?redirect=${encodeURIComponent(`/journal/${postSlug}`)}`);
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      if (next) await api.post(`/guides/${post.guide.id}/follow`);
      else await api.delete(`/guides/${post.guide.id}/follow`);
    } catch {
      setFollowing(!next); // revert
      toast.error('Could not update follow — please try again.');
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ height: 16, background: '#f0eeeb', borderRadius: 4, width: '30%', marginBottom: 20 }} />
        <div style={{ height: 48, background: '#f0eeeb', borderRadius: 4, marginBottom: 16 }} />
        <div style={{ height: 20, background: '#f0eeeb', borderRadius: 4, width: '60%', marginBottom: 40 }} />
        <div style={{ height: 400, background: '#FEF7F0', borderRadius: 12 }} />
      </div>
    );
  }

  if (!post) return <div style={{ padding: 100, textAlign: 'center' }}>Post not found</div>;

  // Imported articles are Markdown; guide posts are HTML from the dashboard
  // editor (with some legacy Tiptap JSON rows that get repaired). contentFormat
  // decides, so nothing has to sniff the content.
  const bodyHtml = renderArticleBody(post.content, post.contentFormat);
  // Editorial articles carry an authored read time; fall back to a word count.
  const readTime = post.readTime ?? estimateReadTime(bodyHtml);
  const byline = post.guide?.displayName ?? post.authorName ?? 'Spiritual California';

  // Share handlers — pure client-side, no backend needed. Twitter/LinkedIn
  // open the network's share-intent in a new tab; Copy Link writes the
  // current URL to the clipboard with toast feedback.
  const handleShare = (network: string) => {
    const url = window.location.href;
    if (network === 'Twitter') {
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`,
        '_blank', 'noopener,noreferrer',
      );
    } else if (network === 'LinkedIn') {
      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
        '_blank', 'noopener,noreferrer',
      );
    } else if (network === 'Copy Link') {
      navigator.clipboard?.writeText(url)
        .then(() => toast.success('Link copied to clipboard'))
        .catch(() => toast.error('Could not copy link — please copy it from the address bar.'));
    }
  };

  return (
    <>
      <ReadingProgressBar />

      {/* Article Header */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px 0' }}>
        {/* Category breadcrumb */}
        <div style={{
          fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#8A8278', marginBottom: 20,
        }}>
          <Link href="/journal" style={{ color: '#F07814', textDecoration: 'none' }}>Journal</Link>
          {post.tags[0] && <> › <span style={{ color: '#F07814' }}>{post.tags[0]}</span></>}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(30px, 6vw, 52px)', fontWeight: 400, color: '#3A3530', lineHeight: 1.15, marginBottom: 12,
        }}>
          {post.title}
        </h1>

        {/* Subtitle */}
        {post.excerpt && (
          <p style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(16px, 4vw, 22px)', fontStyle: 'italic', color: '#8A8278',
            lineHeight: 1.5, marginBottom: 32,
          }}>
            {post.excerpt}
          </p>
        )}

        {/* Author bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          paddingBottom: 32, borderBottom: '1px solid rgba(240,120,20,0.15)',
        }}>
          {/* Avatar links to the practitioner; editorial articles get the mark. */}
          {post.guide ? (
            <Link href={`/guides/${post.guide.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', border: '2px solid #F07814',
                overflow: 'hidden', background: '#FEF7F0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {post.guide.user.avatarUrl ? (
                  <img src={post.guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: '#F07814' }}>
                    {post.guide.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </span>
                )}
              </div>
            </Link>
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: '50%', border: '2px solid #F07814',
              background: '#FEF7F0', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: '#F07814' }}>
                SC
              </span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            {post.guide ? (
              <Link href={`/guides/${post.guide.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{byline}</div>
              </Link>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{byline}</div>
            )}
            <div style={{ fontSize: 12, color: '#8A8278' }}>
              {post.authorRole ? `${post.authorRole} · ` : ''}
              {post.publishedAt && formatDate(post.publishedAt)} · {readTime}
            </div>
          </div>
          {/* Nothing to follow on an editorial article. */}
          {post.guide && (
            <button
              onClick={handleFollow}
              disabled={followBusy}
              style={{
                padding: '7px 18px', borderRadius: 6,
                background: following ? '#F07814' : 'transparent',
                border: `1.5px solid ${following ? '#F07814' : 'rgba(240,120,20,0.3)'}`,
                fontSize: 11, fontWeight: 500, color: following ? '#fff' : '#3A3530',
                cursor: followBusy ? 'default' : 'pointer',
              }}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Hero Image */}
      {post.coverImageUrl && (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
          <img src={post.coverImageUrl} alt={post.title} style={{
            width: '100%', height: 'clamp(220px, 50vw, 520px)', objectFit: 'cover', borderRadius: 12,
          }} />
        </div>
      )}

      {/* Article Body */}
      <div className="article-body" style={{
        maxWidth: 680, margin: '0 auto', padding: '40px 24px 48px',
        fontSize: 19, fontWeight: 300, color: '#3A3530', lineHeight: 1.85,
      }}>
        <style>{`
          .article-body h2 {
            font-family: 'Playfair Display', serif;
            font-size: 34px; font-weight: 500; color: #3A3530;
            margin: 48px 0 16px; line-height: 1.25;
          }
          .article-body h3 {
            font-family: 'Playfair Display', serif;
            font-size: 26px; font-weight: 500; color: #3A3530;
            margin: 36px 0 12px; line-height: 1.3;
          }
          .article-body p { margin-bottom: 28px; }
          .article-body blockquote {
            border-left: 4px solid #F07814;
            background: #FEF7F0; padding: 24px 32px;
            margin: 32px 0; border-radius: 0 8px 8px 0;
            font-family: 'Playfair Display', serif;
            font-size: 22px; font-style: italic; color: #3A3530;
            line-height: 1.5;
          }
          .article-body blockquote cite {
            display: block; margin-top: 12px;
            font-size: 13px; font-style: normal; color: #8A8278;
            font-family: 'Inter', sans-serif;
          }
          .article-body img {
            width: 100%; border-radius: 8px; margin: 32px 0;
          }
        `}</style>
        <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div style={{
          maxWidth: 680, margin: '0 auto', padding: '0 24px 32px',
          display: 'flex', flexWrap: 'wrap', gap: 8,
        }}>
          {post.tags.map((tag) => (
            <span key={tag} style={{
              padding: '6px 16px', borderRadius: 20,
              background: '#FEF7F0', border: '1px solid rgba(240,120,20,0.2)',
              fontSize: 12, color: '#3A3530',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Share Bar */}
      <div style={{
        maxWidth: 680, margin: '0 auto', padding: '24px',
        borderTop: '1px solid rgba(240,120,20,0.15)',
        borderBottom: '1px solid rgba(240,120,20,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#8A8278', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Share</span>
          {['Twitter', 'LinkedIn', 'Copy Link'].map((s) => (
            <button key={s} onClick={() => handleShare(s)} style={{
              padding: '8px 16px', borderRadius: 6,
              background: 'transparent', border: '1.5px solid rgba(240,120,20,0.2)',
              fontSize: 11, color: '#3A3530', cursor: 'pointer',
            }}>
              {s}
            </button>
          ))}
        </div>
        {/* Applaud — clap tally from POST /blog/:id/applaud, deduped per device. */}
        <button
          onClick={handleApplaud}
          disabled={hasApplauded}
          title={hasApplauded ? 'You already applauded this post' : 'Applaud this post'}
          style={{
            padding: '10px 20px', borderRadius: 24,
            background: hasApplauded ? '#FEF7F0' : 'transparent',
            border: '1.5px solid #F07814',
            fontSize: 12, color: '#3A3530', cursor: hasApplauded ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          👏 Applaud{applause > 0 ? ` · ${applause}` : ''}
        </button>
      </div>

      {/*
        Standing disclaimer, rendered by the template when healthAdjacent is
        set — never hand-written into an article body, per §6 of the style spec.
      */}
      {post.healthAdjacent && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 24px' }}>
          <p className="journal-article__disclaimer" style={{
            fontSize: 13, lineHeight: 1.6, color: '#8A8278', fontStyle: 'italic',
            borderTop: '1px solid rgba(240,120,20,0.15)', paddingTop: 20, margin: 0,
          }}>
            Educational content, not medical advice. Talk to a qualified provider
            about your situation. If you need support now, see{' '}
            <Link href="/crisis-support" style={{ color: '#F07814', textDecoration: 'underline' }}>
              crisis resources
            </Link>.
          </p>
        </div>
      )}

      {/* Author Bio Card — practitioner posts only; editorial has no guide. */}
      {post.guide && (
        <AuthorBioCard
          slug={post.guide.slug}
          name={post.guide.displayName}
          tagline={post.guide.tagline || undefined}
          bio={post.guide.bio || undefined}
          avatarUrl={post.guide.user.avatarUrl || undefined}
          isFollowing={following}
          followBusy={followBusy}
          onFollow={handleFollow}
        />
      )}

      {/* Related Posts — only render if the /blog feed returned neighbours */}
      {related.length > 0 && (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px' }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
            color: '#F07814', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            You May Also Like
            <span style={{ flex: 1, height: 1, background: 'rgba(240,120,20,0.25)' }} />
          </div>
          <div className="sc-cards-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {related.map((rp) => (
              <PostCard
                key={rp.id}
                postSlug={rp.slug}
                title={rp.title}
                excerpt={rp.excerpt || undefined}
                category={rp.tags?.[0]}
                authorName={rp.guide?.displayName ?? rp.authorName ?? 'Spiritual California'}
                publishedAt={rp.publishedAt ? formatDate(rp.publishedAt) : ''}
                readTime={rp.readTime ?? '5 min read'}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
