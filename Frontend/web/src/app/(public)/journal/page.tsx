'use client';

import { useState, useEffect } from 'react';
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
  guide: {
    slug: string;
    displayName: string;
    user: { avatarUrl: string | null };
  };
}

const filterTabs = ['All', 'Spiritual Practices', 'Sound Healing', 'Meditation', 'Wellness', 'Sacred Living'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function JournalPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await api.get('/blog', { params: { limit: 20 } });
        setPosts(res.data?.posts ?? []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  // Derive topic chips from the tags of posts we actually have. Avoids
  // hardcoding a curated list that can drift from what's published.
  const topics = Array.from(
    new Set(posts.flatMap((p) => p.tags || [])),
  ).slice(0, 10);

  const featured = posts[0];
  const remaining = posts.slice(1);

  return (
    <>
      {/* Page Hero */}
      <div style={{
        textAlign: 'center', padding: '72px 48px 48px',
        background: 'linear-gradient(180deg, #fff 0%, #FAFAF7 100%)',
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#E8B84B', marginBottom: 12,
        }}>
          ✦ The Journal
        </div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 48, fontWeight: 400, color: '#3A3530', lineHeight: 1.15, marginBottom: 10,
        }}>
          Stories, Practices &amp; Wisdom
        </h1>
        <p style={{ fontSize: 15, color: '#8A8278', maxWidth: 520, margin: '0 auto' }}>
          Explorations in consciousness, healing, and the spiritual path — written by our verified practitioners.
        </p>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid rgba(232,184,75,0.1)',
        position: 'sticky', top: 69, zIndex: 90,
        padding: '0 48px',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {filterTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                style={{
                  padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, letterSpacing: '0.06em',
                  fontWeight: activeFilter === tab ? 600 : 400,
                  color: activeFilter === tab ? '#3A3530' : '#8A8278',
                  borderBottom: activeFilter === tab ? '2px solid #E8B84B' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              style={{
                padding: '9px 16px 9px 36px', borderRadius: 24,
                background: '#FAFAF7', border: '1px solid rgba(232,184,75,0.15)',
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
          maxWidth: 1200, margin: '0 auto', padding: '20px 48px',
          display: 'flex', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: '#8A8278', alignSelf: 'center', marginRight: 8 }}>Browse:</span>
          {topics.map((topic) => (
            <button key={topic} style={{
              padding: '6px 14px', borderRadius: 20,
              background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)',
              fontSize: 12, color: '#3A3530', cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* Main Body */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 48px 80px' }}>

        {/* Section Label */}
        <div style={{
          fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#E8B84B', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          Featured
          <span style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
        </div>

        {/* Featured Hero */}
        {featured && (
          <FeaturedHero
            guideSlug={featured.guide.slug}
            postSlug={featured.slug}
            title={featured.title}
            excerpt={featured.excerpt || undefined}
            coverImageUrl={featured.coverImageUrl || undefined}
            category={featured.tags[0]}
            authorName={featured.guide.displayName}
            authorAvatar={featured.guide.user.avatarUrl || undefined}
            publishedAt={featured.publishedAt ? formatDate(featured.publishedAt) : ''}
            readTime="8 min read"
          />
        )}

        {/* Latest Posts */}
        <div style={{
          fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#E8B84B', marginBottom: 24, marginTop: 40,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          Latest Posts
          <span style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(232,184,75,0.1)' }}>
                <div style={{ height: 190, background: '#FDF6E3' }} />
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
            background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)', borderRadius: 16,
            color: '#8A8278', fontSize: 14,
          }}>
            No articles yet. Check back soon — new stories land here from our verified practitioners.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
            {remaining.map((post) => (
              <PostCard
                key={post.id}
                guideSlug={post.guide.slug}
                postSlug={post.slug}
                title={post.title}
                excerpt={post.excerpt || undefined}
                coverImageUrl={post.coverImageUrl || undefined}
                category={post.tags[0]}
                authorName={post.guide.displayName}
                authorAvatar={post.guide.user.avatarUrl || undefined}
                publishedAt={post.publishedAt ? formatDate(post.publishedAt) : ''}
                readTime="5 min read"
              />
            ))}
          </div>
        )}

        {/* Load more */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button style={{
            padding: '14px 32px', borderRadius: 8,
            background: 'transparent', border: '1.5px solid rgba(232,184,75,0.3)',
            fontFamily: "'Inter', sans-serif",
            fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#3A3530', cursor: 'pointer',
          }}>
            Load More Articles
          </button>
        </div>
      </div>
    </>
  );
}
