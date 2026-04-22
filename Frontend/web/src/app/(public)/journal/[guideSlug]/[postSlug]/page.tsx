'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
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
  guide: {
    slug: string;
    displayName: string;
    tagline: string | null;
    bio: string | null;
    user: { avatarUrl: string | null };
  };
}

interface RelatedPostApi {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  tags: string[];
  guide: { slug: string; displayName: string };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function SinglePostPage() {
  const params = useParams();
  const guideSlug = params.guideSlug as string;
  const postSlug = params.postSlug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<RelatedPostApi[]>([]);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await api.get(`/blog/${guideSlug}/${postSlug}`);
        setPost(res.data);
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [guideSlug, postSlug]);

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

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ height: 16, background: '#f0eeeb', borderRadius: 4, width: '30%', marginBottom: 20 }} />
        <div style={{ height: 48, background: '#f0eeeb', borderRadius: 4, marginBottom: 16 }} />
        <div style={{ height: 20, background: '#f0eeeb', borderRadius: 4, width: '60%', marginBottom: 40 }} />
        <div style={{ height: 400, background: '#FDF6E3', borderRadius: 12 }} />
      </div>
    );
  }

  if (!post) return <div style={{ padding: 100, textAlign: 'center' }}>Post not found</div>;

  const readTime = `${Math.max(1, Math.ceil(post.content.replace(/<[^>]+>/g, '').split(' ').length / 200))} min read`;

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
          <Link href="/journal" style={{ color: '#E8B84B', textDecoration: 'none' }}>Journal</Link>
          {post.tags[0] && <> › <span style={{ color: '#E8B84B' }}>{post.tags[0]}</span></>}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 52, fontWeight: 400, color: '#3A3530', lineHeight: 1.15, marginBottom: 12,
        }}>
          {post.title}
        </h1>

        {/* Subtitle */}
        {post.excerpt && (
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22, fontStyle: 'italic', color: '#8A8278',
            lineHeight: 1.5, marginBottom: 32,
          }}>
            {post.excerpt}
          </p>
        )}

        {/* Author bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          paddingBottom: 32, borderBottom: '1px solid rgba(232,184,75,0.15)',
        }}>
          <Link href={`/guides/${post.guide.slug}`} style={{ textDecoration: 'none' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', border: '2px solid #E8B84B',
              overflow: 'hidden', background: '#FDF6E3',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {post.guide.user.avatarUrl ? (
                <img src={post.guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, color: '#E8B84B' }}>
                  {post.guide.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </span>
              )}
            </div>
          </Link>
          <div style={{ flex: 1 }}>
            <Link href={`/guides/${post.guide.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{post.guide.displayName}</div>
            </Link>
            <div style={{ fontSize: 12, color: '#8A8278' }}>
              {post.publishedAt && formatDate(post.publishedAt)} · {readTime}
            </div>
          </div>
          <button style={{
            padding: '7px 18px', borderRadius: 6,
            background: 'transparent', border: '1.5px solid rgba(232,184,75,0.3)',
            fontSize: 11, fontWeight: 500, color: '#3A3530', cursor: 'pointer',
          }}>
            Follow
          </button>
        </div>
      </div>

      {/* Hero Image */}
      {post.coverImageUrl && (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
          <img src={post.coverImageUrl} alt={post.title} style={{
            width: '100%', height: 520, objectFit: 'cover', borderRadius: 12,
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
            font-family: 'Cormorant Garamond', serif;
            font-size: 34px; font-weight: 500; color: #3A3530;
            margin: 48px 0 16px; line-height: 1.25;
          }
          .article-body h3 {
            font-family: 'Cormorant Garamond', serif;
            font-size: 26px; font-weight: 500; color: #3A3530;
            margin: 36px 0 12px; line-height: 1.3;
          }
          .article-body p { margin-bottom: 28px; }
          .article-body blockquote {
            border-left: 4px solid #E8B84B;
            background: #FDF6E3; padding: 24px 32px;
            margin: 32px 0; border-radius: 0 8px 8px 0;
            font-family: 'Cormorant Garamond', serif;
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
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
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
              background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)',
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
        borderTop: '1px solid rgba(232,184,75,0.15)',
        borderBottom: '1px solid rgba(232,184,75,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#8A8278', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Share</span>
          {['Twitter', 'LinkedIn', 'Copy Link'].map((s) => (
            <button key={s} style={{
              padding: '8px 16px', borderRadius: 6,
              background: 'transparent', border: '1.5px solid rgba(232,184,75,0.2)',
              fontSize: 11, color: '#3A3530', cursor: 'pointer',
            }}>
              {s}
            </button>
          ))}
        </div>
        {/* Applaud count is derived from the backend once that API lands.
            Until then, render a functional button without a fake count. */}
        <button style={{
          padding: '10px 20px', borderRadius: 24,
          background: 'transparent', border: '1.5px solid #E8B84B',
          fontSize: 12, color: '#3A3530', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Applaud
        </button>
      </div>

      {/* Author Bio Card */}
      <AuthorBioCard
        slug={post.guide.slug}
        name={post.guide.displayName}
        tagline={post.guide.tagline || undefined}
        bio={post.guide.bio || undefined}
        avatarUrl={post.guide.user.avatarUrl || undefined}
      />

      {/* Related Posts — only render if the /blog feed returned neighbours */}
      {related.length > 0 && (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px' }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
            color: '#E8B84B', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            You May Also Like
            <span style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {related.map((rp) => (
              <PostCard
                key={rp.id}
                guideSlug={rp.guide.slug}
                postSlug={rp.slug}
                title={rp.title}
                excerpt={rp.excerpt || undefined}
                category={rp.tags?.[0]}
                authorName={rp.guide.displayName}
                publishedAt={rp.publishedAt ? formatDate(rp.publishedAt) : ''}
                readTime="5 min read"
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
