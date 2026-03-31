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

const fallbackPost: BlogPost = {
  id: 'demo',
  title: 'The Silence Between the Notes: What Sound Healing Taught Me About Presence',
  slug: 'silence-between-notes',
  content: `<p>There's a moment in every sound healing session that I live for. It's not when the singing bowl first rings — though that initial vibration is beautiful. It's not the crescendo, when multiple frequencies weave together into something that feels like it's rearranging your cells.</p>

<p>It's the silence that follows.</p>

<h2>The Discovery</h2>

<p>When I first began studying sound healing twelve years ago in Nepal, my teacher Rinpoche said something that puzzled me for years: "The sound is not the healing. The silence is the healing. The sound is only the door."</p>

<p>I didn't understand. I was obsessed with frequencies — 432 Hz, 528 Hz, the Solfeggio scale. I spent hours tuning bowls, measuring harmonics, studying the physics of resonance. I thought precision was the point.</p>

<blockquote>
"The sound is not the healing. The silence is the healing. The sound is only the door."
<cite>— Rinpoche, Kathmandu, 2014</cite>
</blockquote>

<h2>What Changes in the Silence</h2>

<p>When a singing bowl fades, something remarkable happens in the listener's nervous system. The brain, which has been entrained to the bowl's frequency, doesn't immediately return to its default patterns. There's a gap — a neurological pause where the mind is genuinely, completely still.</p>

<p>This isn't meditation through effort. This is stillness through surrender. The sound does the work of quieting the mental chatter, and then when it stops, you're left in a space that most people spend years of meditation practice trying to reach.</p>

<h2>Bringing It Home</h2>

<p>You don't need a practitioner to access this. Here's a simple practice you can try tonight:</p>

<p>Find any resonant object — a singing bowl if you have one, but even a wine glass or a bell will work. Strike it once. Close your eyes. Follow the sound as it fades. And when it disappears, stay with what remains.</p>

<p>That space — between the last vibration and your next thought — is where the healing lives.</p>

<p>It's always been there. The sound just helps you find the door.</p>`,
  excerpt: 'In the resonant pause after a singing bowl fades, I found something I had been chasing for years.',
  coverImageUrl: null,
  tags: ['Sound Healing', 'Meditation', 'Consciousness', 'Presence', 'Healing', 'Mindfulness'],
  publishedAt: '2026-03-15',
  guide: {
    slug: 'maya-williams',
    displayName: 'Maya Williams',
    tagline: 'Sound Healer & Reiki Master',
    bio: 'Maya has been practicing sound healing for over 12 years, trained in the Himalayan singing bowl tradition. She leads workshops, retreats, and private sessions from her studio in Los Angeles.',
    user: { avatarUrl: null },
  },
};

const relatedPosts = [
  { id: '2', title: 'A Beginner\'s Guide to Crystal Energy Work', slug: 'crystal-energy-work', excerpt: 'Crystals have been used for thousands of years across cultures.', guideSlug: 'dr-sarah-chen', guideName: 'Dr. Sarah Chen', date: 'Mar 10, 2026', tags: ['Crystals'] },
  { id: '3', title: 'Breathwork for Anxiety: 5 Techniques', slug: 'breathwork-anxiety', excerpt: 'The breathing techniques I recommend most for managing anxiety.', guideSlug: 'marcus-thompson', guideName: 'Marcus Thompson', date: 'Mar 5, 2026', tags: ['Breathwork'] },
  { id: '4', title: 'The Ancient Art of Qi Gong', slug: 'qigong-modern-life', excerpt: 'Qi Gong bridges the gap between exercise and meditation.', guideSlug: 'carlos-mendez', guideName: 'Carlos Mendez', date: 'Feb 28, 2026', tags: ['Qi Gong'] },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function SinglePostPage() {
  const params = useParams();
  const guideSlug = params.guideSlug as string;
  const postSlug = params.postSlug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await api.get(`/blog/${guideSlug}/${postSlug}`);
        setPost(res.data);
      } catch {
        setPost(fallbackPost);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [guideSlug, postSlug]);

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
        <button style={{
          padding: '10px 20px', borderRadius: 24,
          background: 'transparent', border: '1.5px solid #E8B84B',
          fontSize: 12, color: '#3A3530', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          👏 47
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

      {/* Related Posts */}
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
          {relatedPosts.map((rp) => (
            <PostCard
              key={rp.id}
              guideSlug={rp.guideSlug}
              postSlug={rp.slug}
              title={rp.title}
              excerpt={rp.excerpt}
              category={rp.tags[0]}
              authorName={rp.guideName}
              publishedAt={rp.date}
              readTime="5 min read"
            />
          ))}
        </div>
      </div>
    </>
  );
}
