'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string;
}

interface GuideService {
  price: number | string;
  type: string;
  durationMin: number;
}

interface Guide {
  id: string;
  slug: string;
  displayName: string;
  tagline: string | null;
  location: string | null;
  modalities: string[];
  isVerified: boolean;
  isFeatured?: boolean;
  averageRating: number;
  totalReviews: number;
  user: { avatarUrl: string | null };
  blogPosts: BlogPost[];
  services?: GuideService[];
}

interface MatchedPractitioner {
  id: string;
  slug: string;
  displayName: string;
  rating: number;
}

// ─── Filter configuration (slugs are the values stored on guide.modalities) ─

const MODALITIES = [
  { slug: 'all', label: 'All' },
  { slug: 'Sound Healing', label: 'Sound Healing' },
  { slug: 'Reiki', label: 'Reiki' },
  { slug: 'Breathwork', label: 'Breathwork' },
  { slug: 'Qigong', label: 'Qigong' },
  { slug: 'Meditation', label: 'Meditation' },
  { slug: 'Ayurveda', label: 'Ayurveda' },
  { slug: 'Yoga', label: 'Yoga' },
  { slug: 'Coaching', label: 'Coaching' },
];

const RATING_FILTERS = [
  { value: 0, label: 'All ★' },
  { value: 4, label: '4+ ★' },
  { value: 4.5, label: '4.5+ ★' },
  { value: 4.8, label: '4.8+ ★' },
];

const AI_CHIPS = [
  'I need help with anxiety and stress',
  'I want to start breathwork',
  'energy healing and Reiki',
  'Qigong or Tai Chi teacher',
  'grief and emotional healing',
  'sound healing near Los Angeles',
];

// ─── Fallback images ────────────────────────────────────────────────────────

const FALLBACK_POST_IMAGES = [
  '/images/hero1.jpg',
  '/images/hero2.jpg',
  '/images/hero3.jpg',
  '/images/yoga_outdoor.jpg',
  '/images/ayurveda.jpg',
  '/images/poppy_close.jpg',
  '/images/poppy_field.jpg',
];

function pickFallbackImage(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i)) % 997;
  return FALLBACK_POST_IMAGES[hash % FALLBACK_POST_IMAGES.length];
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function PractitionersPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [featured, setFeatured] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModality, setActiveModality] = useState<string>('all');
  const [activeStars, setActiveStars] = useState<number>(0);

  // AI bar state
  const [aiInput, setAiInput] = useState('');
  const [aiReply, setAiReply] = useState<string>('');
  const [aiMatched, setAiMatched] = useState<MatchedPractitioner[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch listing whenever filters change
  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (activeModality !== 'all') params.modality = activeModality;
    if (activeStars > 0) params.minRating = String(activeStars);
    api
      .get('/guides/public', { params })
      .then((res) => {
        setGuides(res.data?.guides || []);
        setFeatured(res.data?.featured || []);
      })
      .catch(() => {
        setGuides([]);
        setFeatured([]);
      })
      .finally(() => setLoading(false));
  }, [activeModality, activeStars]);

  const askAI = async (query?: string) => {
    const q = (query ?? aiInput).trim();
    if (!q) return;
    setAiInput(q);
    setAiLoading(true);
    setAiReply('');
    setAiMatched([]);
    try {
      const res = await api.post('/ai/practitioner-match', { query: q });
      setAiReply(res.data?.reply || '');
      setAiMatched(res.data?.practitioners || []);
    } catch {
      setAiReply('Our AI guide is resting. Try browsing practitioners below.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSubmit = (e: FormEvent) => {
    e.preventDefault();
    askAI();
  };

  return (
    <>
      {/* ── AI GUIDE BAR ─────────────────────────────────────────────── */}
      <div style={{
        marginTop: 69,
        background: 'linear-gradient(135deg, #2C2420 0%, #3A3530 100%)',
        padding: '32px 48px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: '#E8B84B', marginBottom: 8,
          }}>
            ✦ AI Guide
          </div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, fontWeight: 400, color: '#fff', marginBottom: 4,
          }}>
            Who are you looking for?
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 18 }}>
            Describe what you need — our guide will match you with the right practitioner.
          </p>
          <form
            onSubmit={handleAiSubmit}
            style={{
              display: 'flex', background: 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(232,184,75,0.35)', borderRadius: 12,
              overflow: 'hidden', maxWidth: 680, margin: '0 auto 14px',
              transition: 'border-color 0.3s',
            }}
          >
            <span style={{
              padding: '0 16px', display: 'flex', alignItems: 'center',
              fontSize: 20, color: '#E8B84B',
            }}>✨</span>
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder='e.g. "someone to help with grief" or "Qigong teacher in the Bay Area"'
              style={{
                flex: 1, padding: '14px 8px', background: 'none',
                border: 'none', outline: 'none', color: '#fff', fontSize: 14,
                fontFamily: "'Inter', sans-serif",
              }}
            />
            <button
              type="submit"
              disabled={aiLoading}
              style={{
                padding: '14px 24px', background: '#E8B84B', border: 'none',
                color: '#3A3530', fontSize: 12, fontWeight: 600,
                letterSpacing: '0.08em', cursor: aiLoading ? 'wait' : 'pointer',
                opacity: aiLoading ? 0.7 : 1,
                transition: 'background 0.2s',
              }}
            >
              {aiLoading ? '…' : 'Find →'}
            </button>
          </form>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {AI_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => askAI(chip)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid rgba(232,184,75,0.3)',
                  borderRadius: 20, fontSize: 11,
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  transition: 'all 0.2s', background: 'none',
                }}
              >
                {chip.length > 28 ? chip.slice(0, 26) + '…' : chip}
              </button>
            ))}
          </div>
          {(aiReply || aiMatched.length > 0) && (
            <div style={{
              maxWidth: 680, margin: '14px auto 0',
              padding: '14px 18px',
              background: 'rgba(232,184,75,0.1)',
              border: '1px solid rgba(232,184,75,0.25)',
              borderRadius: 10,
              fontSize: 13, color: 'rgba(255,255,255,0.85)',
              textAlign: 'left', lineHeight: 1.6,
            }}>
              {aiReply && <div style={{ marginBottom: aiMatched.length > 0 ? 10 : 0 }}>✨ {aiReply}</div>}
              {aiMatched.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {aiMatched.map((p) => (
                    <Link
                      key={p.id}
                      href={`/guides/${p.slug}`}
                      style={{
                        padding: '6px 14px', borderRadius: 20,
                        background: '#E8B84B', color: '#3A3530',
                        fontSize: 12, fontWeight: 500, textDecoration: 'none',
                      }}
                    >
                      {p.displayName}{p.rating ? ` · ${p.rating.toFixed(1)}★` : ''}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── PAGE HEADER ───────────────────────────────────────────────── */}
      <div style={{ padding: '48px 48px 0', maxWidth: 1280, margin: '0 auto' }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 42, fontWeight: 300, color: '#3A3530', marginBottom: 6,
        }}>
          Our Practitioners
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278' }}>
          Every guide on Spiritual California is personally reviewed, credentialed, and community-endorsed.
        </p>
      </div>

      {/* ── FILTERS ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 69, zIndex: 50,
        background: 'rgba(250,250,247,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(232,184,75,0.12)',
        padding: '16px 48px',
        marginTop: 24,
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={filterLabelStyle}>Modality</span>
            {MODALITIES.map((m) => (
              <FilterPill
                key={m.slug}
                active={activeModality === m.slug}
                onClick={() => setActiveModality(m.slug)}
                label={m.label}
              />
            ))}
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(138,130,120,0.2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={filterLabelStyle}>Min Rating</span>
            {RATING_FILTERS.map((r) => (
              <FilterPill
                key={r.value}
                active={activeStars === r.value}
                onClick={() => setActiveStars(r.value)}
                label={r.label}
              />
            ))}
          </div>
          <span style={{ fontSize: 12, color: '#8A8278', marginLeft: 'auto' }}>
            Showing {guides.length} practitioner{guides.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 48px 80px' }}>
        {/* Featured strip */}
        {featured.length > 0 && (
          <>
            <SectionHead title="Featured Practitioners" badge="✦ Editor's Choice" />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
              marginBottom: 64,
            }} className="featured-strip">
              {featured.slice(0, 3).map((g) => (
                <FeaturedCard key={g.id} guide={g} />
              ))}
            </div>
          </>
        )}

        {/* All practitioners */}
        <SectionHead title="All Practitioners" />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#8A8278', fontSize: 14 }}>
            Loading practitioners…
          </div>
        ) : guides.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8A8278' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#3A3530', marginBottom: 8 }}>
              No practitioners found
            </h3>
            <p>Try adjusting your filters or ask the AI guide above.</p>
          </div>
        ) : (
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}
            className="practitioners-grid"
          >
            {guides.map((g) => (
              <PractitionerCard key={g.id} guide={g} />
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media (max-width: 1100px) {
          .practitioners-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 900px) {
          .featured-strip { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .practitioners-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .featured-strip { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .practitioners-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const filterLabelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
  color: '#8A8278', whiteSpace: 'nowrap',
};

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 20,
        border: `1px solid ${active ? '#E8B84B' : 'rgba(138,130,120,0.3)'}`,
        fontSize: 12,
        color: active ? '#3A3530' : '#8A8278',
        cursor: 'pointer',
        background: active ? '#E8B84B' : 'transparent',
        fontWeight: active ? 500 : 400,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  );
}

function SectionHead({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 22, fontWeight: 400, color: '#3A3530', whiteSpace: 'nowrap',
      }}>
        {title}
      </h2>
      {badge && (
        <span style={{
          fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#E8B84B', background: 'rgba(232,184,75,0.1)',
          padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap',
        }}>
          {badge}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
    </div>
  );
}

function FeaturedCard({ guide }: { guide: Guide }) {
  const post = guide.blogPosts?.[0];
  const img = post?.coverImageUrl || pickFallbackImage(guide.slug);
  const postHref = post ? `/journal/${guide.slug}/${post.slug}` : `/guides/${guide.slug}`;
  const primaryMod = guide.modalities?.[0] || 'Practitioner';

  return (
    <div style={{ position: 'relative' }}>
      <Link
        href={postHref}
        style={{
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 2px 20px rgba(58,53,48,0.07)',
          textDecoration: 'none', color: 'inherit',
          transition: 'transform 0.3s, box-shadow 0.3s',
          display: 'flex', flexDirection: 'column', height: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(58,53,48,0.13)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 20px rgba(58,53,48,0.07)';
        }}
      >
        <img src={img} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
        <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: '#E8B84B', marginBottom: 6,
          }}>
            {primaryMod}{post ? ' · Latest Post' : ''}
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 16, fontWeight: 500, color: '#3A3530',
            marginBottom: 12, lineHeight: 1.4,
          }}>
            {post?.title || guide.tagline || guide.displayName}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto',
            paddingTop: 14, borderTop: '1px solid rgba(232,184,75,0.15)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
              background: '#FDF6E3',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: '#E8B84B',
            }}>
              {guide.user.avatarUrl ? (
                <img src={guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                guide.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: '#3A3530',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {guide.displayName}
                {guide.isVerified && (
                  <span style={{
                    width: 8, height: 8, background: '#4CAF50',
                    borderRadius: '50%', flexShrink: 0,
                  }} />
                )}
              </div>
              <div style={{
                fontSize: 11, color: '#8A8278',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {[primaryMod, guide.location].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#8A8278' }}>
              {guide.averageRating ? `${guide.averageRating.toFixed(1)} ★` : '—'}
            </div>
          </div>
        </div>
      </Link>
      <div style={{
        position: 'absolute', top: 12, left: 12,
        background: '#E8B84B', color: '#3A3530',
        fontSize: 9, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', padding: '4px 10px', borderRadius: 10,
      }}>
        Featured
      </div>
    </div>
  );
}

function PractitionerCard({ guide }: { guide: Guide }) {
  const post = guide.blogPosts?.[0];
  const img = post?.coverImageUrl || pickFallbackImage(guide.slug);
  const postPreview = post?.excerpt
    || guide.tagline
    || 'A trusted, verified practitioner on Spiritual California.';

  return (
    <Link
      href={`/guides/${guide.slug}`}
      style={{
        background: '#fff', borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 2px 14px rgba(58,53,48,0.06)',
        textDecoration: 'none', color: 'inherit',
        transition: 'transform 0.3s, box-shadow 0.3s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(58,53,48,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 14px rgba(58,53,48,0.06)';
      }}
    >
      <div style={{ position: 'relative' }}>
        <img src={img} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: -22, left: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid #fff', overflow: 'hidden',
            background: '#FDF6E3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 600, color: '#E8B84B',
          }}>
            {guide.user.avatarUrl ? (
              <img src={guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              guide.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)
            )}
          </div>
          {guide.isVerified && (
            <div style={{
              position: 'absolute', bottom: 0, left: 30,
              width: 18, height: 18, borderRadius: '50%',
              background: '#4CAF50', border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: '#fff', fontWeight: 700,
            }}>
              ✓
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '32px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 17, fontWeight: 500, color: '#3A3530', marginBottom: 3,
        }}>
          {guide.displayName}
        </div>
        <div style={{ fontSize: 11, color: '#8A8278', marginBottom: 10 }}>
          {[guide.modalities[0], guide.location].filter(Boolean).join(' · ')}
        </div>
        {guide.modalities.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {guide.modalities.slice(0, 3).map((m) => (
              <span key={m} style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 10,
                background: 'rgba(232,184,75,0.1)', color: '#8A8278',
              }}>
                {m}
              </span>
            ))}
          </div>
        )}
        <div style={{
          fontSize: 12, color: '#8A8278', lineHeight: 1.5, marginBottom: 12, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {post ? <>{post.title} — {postPreview}</> : postPreview}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 12, borderTop: '1px solid rgba(232,184,75,0.15)',
        }}>
          <div style={{ fontSize: 12, color: '#3A3530' }}>
            <span style={{ color: '#E8B84B' }}>★</span> {guide.averageRating ? guide.averageRating.toFixed(1) : '—'}
            {guide.totalReviews > 0 && (
              <span style={{ color: '#8A8278' }}> · {guide.totalReviews} review{guide.totalReviews !== 1 ? 's' : ''}</span>
            )}
          </div>
          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.location.href = `/book/${guide.slug}`;
            }}
            style={{
              fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#3A3530', background: '#E8B84B',
              padding: '6px 14px', borderRadius: 6,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Book
          </span>
        </div>
      </div>
    </Link>
  );
}
