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

const fallbackPosts: BlogPost[] = [
  { id: '1', title: 'The Silence Between the Notes: What Sound Healing Taught Me About Presence', slug: 'silence-between-notes', excerpt: 'In the resonant pause after a singing bowl fades, I found something I had been chasing for years — a presence so complete it needed no effort to maintain.', coverImageUrl: null, tags: ['Sound Healing', 'Meditation'], publishedAt: '2026-03-15', guide: { slug: 'maya-williams', displayName: 'Maya Williams', user: { avatarUrl: null } } },
  { id: '2', title: 'A Beginner\'s Guide to Crystal Energy Work', slug: 'crystal-energy-work', excerpt: 'Crystals have been used for thousands of years across cultures for healing, protection, and spiritual growth. Here\'s how to start your own practice.', coverImageUrl: null, tags: ['Crystals', 'Energy Work'], publishedAt: '2026-03-10', guide: { slug: 'dr-sarah-chen', displayName: 'Dr. Sarah Chen', user: { avatarUrl: null } } },
  { id: '3', title: 'Breathwork for Anxiety: 5 Techniques That Actually Work', slug: 'breathwork-anxiety', excerpt: 'After working with hundreds of clients, these are the breathing techniques I recommend most for managing anxiety in daily life.', coverImageUrl: null, tags: ['Breathwork', 'Wellness'], publishedAt: '2026-03-05', guide: { slug: 'marcus-thompson', displayName: 'Marcus Thompson', user: { avatarUrl: null } } },
  { id: '4', title: 'The Ancient Art of Qi Gong: Moving Meditation for Modern Life', slug: 'qigong-modern-life', excerpt: 'Qi Gong bridges the gap between physical exercise and meditation. Learn how this 4,000-year-old practice can transform your daily routine.', coverImageUrl: null, tags: ['Qi Gong', 'Meditation'], publishedAt: '2026-02-28', guide: { slug: 'carlos-mendez', displayName: 'Carlos Mendez', user: { avatarUrl: null } } },
  { id: '5', title: 'Setting Up Your Home Altar: A Sacred Space Guide', slug: 'home-altar-guide', excerpt: 'Creating a sacred space doesn\'t require a dedicated room. Here\'s how to create a meaningful altar in any living situation.', coverImageUrl: null, tags: ['Sacred Space', 'Rituals'], publishedAt: '2026-02-20', guide: { slug: 'rebecca-stone', displayName: 'Rebecca Stone', user: { avatarUrl: null } } },
  { id: '6', title: 'Understanding Your Chakras: A Practitioner\'s Perspective', slug: 'understanding-chakras', excerpt: 'Beyond the colorful diagrams and quick guides, here\'s what chakra work really looks like from someone who practices it daily.', coverImageUrl: null, tags: ['Chakras', 'Energy Work'], publishedAt: '2026-02-15', guide: { slug: 'priya-sharma', displayName: 'Priya Sharma', user: { avatarUrl: null } } },
];

const topics = ['Meditation', 'Breathwork', 'Sound Healing', 'Reiki', 'Ayurveda', 'Yoga', 'Crystals', 'Mindfulness', 'Sacred Rituals', 'Energy Work'];
const filterTabs = ['All', 'Spiritual Practices', 'Sound Healing', 'Meditation', 'Wellness', 'Sacred Living'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function JournalPage() {
  const [posts, setPosts] = useState<BlogPost[]>(fallbackPosts);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await api.get('/blog', { params: { limit: 20 } });
        if (res.data?.posts && res.data.posts.length > 0) {
          setPosts(res.data.posts);
        }
      } catch {
        // Keep fallback
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

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
