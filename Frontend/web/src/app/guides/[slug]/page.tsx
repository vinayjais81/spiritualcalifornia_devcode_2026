'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/public/layout/Navbar';
import { Footer } from '@/components/public/layout/Footer';

// ─── Types matching the expanded backend API ─────────────────────────────────

interface GuideTag {
  category: string;
  categorySlug: string;
  subcategory: string | null;
}

interface Credential {
  id: string;
  title: string;
  institution: string | null;
  issuedYear: number | null;
  verificationStatus: string;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  type: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
  price: number | string;
  durationMin: number;
}

interface EventTier {
  id: string;
  name: string;
  price: number | string;
  capacity: number;
  sold: number;
}

interface GuideEvent {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  coverImageUrl: string | null;
  ticketTiers: EventTier[];
}

interface GuideSoulTour {
  id: string;
  slug: string;
  title: string;
  shortDesc: string | null;
  location: string | null;
  coverImageUrl: string | null;
  difficultyLevel: string | null;
  nextDepartureStart: string;
  nextDepartureEnd: string;
  spotsRemaining: number;
  startingPrice: number | string;
  currency: string;
}

interface Product {
  id: string;
  name: string;
  type: 'DIGITAL' | 'PHYSICAL';
  price: number | string;
  imageUrls: string[];
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string;
}

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  author: { firstName: string; lastName: string; avatarUrl: string | null };
}

interface Testimonial {
  id: string;
  body: string;
  author: { firstName: string; lastName: string; avatarUrl: string | null };
}

interface GuideProfile {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  tagline: string | null;
  bio: string | null;
  location: string | null;
  languages: string[];
  avatarUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  calendarType: string | null;
  calendarLink: string | null;
  verificationStatus: string;
  isVerified: boolean;
  tags: GuideTag[];
  credentials: Credential[];
  services: Service[];
  events: GuideEvent[];
  soulTours: GuideSoulTour[];
  products: Product[];
  blogPosts: BlogPost[];
  reviews: Review[];
  reviewStats: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
  };
  testimonials: Testimonial[];
  memberSince: string;
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const C = {
  gold: '#E8B84B',
  goldLight: '#F5D98A',
  goldPale: '#FDF6E3',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
  white: '#FFFFFF',
  green: '#5A8A6A',
};

const font = "var(--font-inter), 'Inter', sans-serif";
const serif = "var(--font-cormorant-garamond), 'Cormorant Garamond', serif";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' });
}

function formatDay(iso: string) {
  return new Date(iso).getDate();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatPrice(price: number | string) {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  return n === 0 ? 'Free' : `$${n.toFixed(0)}`;
}

function serviceBadge(type: string) {
  switch (type) {
    case 'VIRTUAL': return { label: 'Online Only', cls: 'badge-online' };
    case 'IN_PERSON': return { label: 'In-Person Only', cls: 'badge-offline' };
    default: return { label: 'Online & In-Person', cls: 'badge-both' };
  }
}

// ─── Section Title Component ─────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: serif, fontSize: '26px', fontWeight: 400, color: C.charcoal,
      marginBottom: '20px', paddingBottom: '12px',
      borderBottom: '1px solid rgba(232,184,75,0.15)',
    }}>
      {children}
    </h2>
  );
}

// ─── Sidebar Widget ──────────────────────────────────────────────────────────

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.white, border: '1px solid rgba(232,184,75,0.12)',
      borderRadius: '12px', padding: '24px', marginBottom: '24px',
    }}>
      <div style={{
        fontFamily: serif, fontSize: '20px', fontWeight: 500, color: C.charcoal,
        marginBottom: '16px', paddingBottom: '10px',
        borderBottom: '1px solid rgba(232,184,75,0.15)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function GuideProfilePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    fetch(`${apiUrl}/guides/profile/${slug}`)
      .then((r) => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then((data) => { if (data) setGuide(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Navbar />
        <div style={{ fontFamily: font, color: C.warmGray, fontSize: '13px', marginTop: '69px' }}>Loading...</div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !guide) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: '600px', margin: '180px auto', textAlign: 'center', padding: '0 24px' }}>
          <p style={{ fontFamily: serif, fontSize: '42px', fontWeight: 300, color: C.charcoal, marginBottom: '16px' }}>
            Guide not found.
          </p>
          <p style={{ fontFamily: font, fontSize: '14px', color: C.warmGray, marginBottom: '32px' }}>
            This profile may have moved or the link may be incorrect.
          </p>
          <Link href="/practitioners" style={{ fontFamily: font, fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.charcoal, textDecoration: 'none', borderBottom: `1.5px solid ${C.gold}`, paddingBottom: '2px' }}>
            Browse All Practitioners
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const avatar = guide.avatarUrl ?? '/images/hero1.jpg';
  const rs = guide.reviewStats;

  return (
    <div>
      <Navbar />

      {/* ── HERO BANNER ──────────────────────────────────────────────── */}
      <div style={{
        marginTop: '69px', height: '320px',
        background: 'linear-gradient(135deg, #2C2420 0%, #4A3C30 40%, #6B5240 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <Image src="/images/yoga_outdoor.jpg" alt="" fill sizes="100vw" className="object-cover" style={{ opacity: 0.35 }} />
        <div style={{ position: 'absolute', right: '80px', bottom: 0, opacity: 0.06, fontSize: '280px', lineHeight: 1, pointerEvents: 'none' }}>
          🌸
        </div>
      </div>

      {/* ── PROFILE HEADER ───────────────────────────────────────────── */}
      <div style={{ background: C.white, borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 48px', position: 'relative' }}>
          {/* Avatar */}
          <div style={{ position: 'absolute', top: '-80px', left: '48px' }}>
            <div style={{ position: 'relative', width: '160px', height: '160px' }}>
              <Image src={avatar} alt={guide.displayName} fill sizes="160px" className="object-cover"
                style={{ borderRadius: '50%', border: `5px solid ${C.white}`, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }} />
              {guide.isVerified && (
                <div style={{
                  position: 'absolute', bottom: '6px', right: '6px',
                  background: C.gold, color: C.white, borderRadius: '50%',
                  width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', border: `3px solid ${C.white}`, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                  ✓
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div style={{
            paddingTop: '28px', paddingLeft: '220px', paddingBottom: '28px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px',
          }} className="profile-meta">
            <div style={{ flex: 1 }}>
              {/* Name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h1 style={{ fontFamily: serif, fontSize: '36px', fontWeight: 500, color: C.charcoal, margin: 0 }}>
                  {guide.displayName}
                </h1>
                {guide.isVerified && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '4px 12px', borderRadius: '20px',
                    background: C.goldPale, border: `1px solid ${C.gold}`,
                    fontFamily: font, fontSize: '11px', color: C.charcoal, letterSpacing: '0.05em',
                  }}>
                    ✓ Verified Practitioner
                  </span>
                )}
              </div>

              {/* Tagline */}
              {guide.tagline && (
                <p style={{ fontFamily: font, fontSize: '15px', color: C.warmGray, marginBottom: '14px', lineHeight: 1.5 }}>
                  {guide.tagline}
                </p>
              )}

              {/* Tags */}
              {guide.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  {guide.tags.map((t, i) => (
                    <span key={i} style={{
                      padding: '5px 14px', borderRadius: '20px',
                      background: C.goldPale, border: '1px solid rgba(232,184,75,0.4)',
                      fontFamily: font, fontSize: '12px', color: C.charcoal,
                    }}>
                      {t.subcategory ?? t.category}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: '28px' }}>
                {[
                  { value: rs.averageRating ? `${rs.averageRating} ★` : '—', label: 'Rating' },
                  { value: rs.totalReviews || '—', label: 'Reviews' },
                ].map(({ value, label }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: serif, fontSize: '24px', fontWeight: 500, color: C.charcoal }}>{value}</div>
                    <div style={{ fontFamily: font, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginTop: '2px' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px', minWidth: '200px' }} className="profile-ctas">
              <a href={`/book/${guide.slug}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px 28px', background: C.gold, color: C.white,
                fontFamily: font, fontSize: '12px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                border: 'none', borderRadius: '8px', cursor: 'pointer', textDecoration: 'none', transition: 'background 0.3s',
              }}>
                📅 Book a Session
              </a>
              <button style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px 28px', background: 'transparent', color: C.charcoal,
                fontFamily: font, fontSize: '12px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                border: '1.5px solid rgba(232,184,75,0.5)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s',
              }}>
                ✉️ Send Message
              </button>
              {guide.location && (
                <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📍 {guide.location}
                </div>
              )}
              {guide.languages.length > 0 && (
                <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🌐 {guide.languages.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY (2-column grid) ─────────────────────────────────────── */}
      <div style={{
        maxWidth: '1100px', margin: '0 auto', padding: '40px 48px',
        display: 'grid', gridTemplateColumns: '1fr 340px', gap: '40px',
      }} className="profile-body-grid">

        {/* ═══ LEFT COLUMN ═══ */}
        <div>

          {/* ── ABOUT ──────────────────────────────────────────────── */}
          {guide.bio && (
            <div style={{ marginBottom: '40px' }}>
              <SectionTitle>About {guide.displayName.split(' ')[0]}</SectionTitle>
              {guide.bio.split('\n').filter(Boolean).map((p, i) => (
                <p key={i} style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.8, color: C.charcoal, marginBottom: '24px' }}>
                  {p}
                </p>
              ))}
            </div>
          )}

          {/* ── SERVICES ───────────────────────────────────────────── */}
          {guide.services.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <SectionTitle>Services</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {guide.services.map((s) => {
                  const badge = serviceBadge(s.type);
                  return (
                    <div key={s.id} style={{
                      background: C.white, border: '1px solid rgba(232,184,75,0.15)',
                      borderRadius: '10px', padding: '18px 20px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                      transition: 'box-shadow 0.3s',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: font, fontSize: '15px', fontWeight: 500, color: C.charcoal, marginBottom: '4px' }}>{s.name}</div>
                        {s.description && <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5 }}>{s.description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                          <span style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>⏱ {s.durationMin} min</span>
                          <span className={badge.cls} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 10px', borderRadius: '20px', fontFamily: font, fontSize: '11px',
                          }}>
                            {badge.label}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                        <div style={{ fontFamily: serif, fontSize: '24px', fontWeight: 500, color: C.charcoal, whiteSpace: 'nowrap' }}>
                          {formatPrice(s.price)}
                        </div>
                        <a href={`/book/${guide.slug}`} style={{
                          padding: '8px 16px', background: C.gold, color: C.white,
                          fontFamily: font, fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                          border: 'none', borderRadius: '8px', cursor: 'pointer', textDecoration: 'none', transition: 'background 0.3s',
                        }}>
                          Book
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── EVENTS ─────────────────────────────────────────────── */}
          {guide.events.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <SectionTitle>Upcoming Events</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {guide.events.map((ev) => {
                  const tier = ev.ticketTiers[0];
                  const spotsLeft = tier ? tier.capacity - tier.sold : null;
                  return (
                    <div key={ev.id} style={{
                      background: C.white, border: '1px solid rgba(232,184,75,0.15)',
                      borderRadius: '10px', overflow: 'hidden', display: 'flex', gap: 0,
                      transition: 'box-shadow 0.3s',
                    }}>
                      <div style={{
                        width: '140px', flexShrink: 0,
                        background: 'linear-gradient(135deg, #4A3C30, #6B5240)',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        {ev.coverImageUrl && (
                          <Image src={ev.coverImageUrl} alt="" fill sizes="140px" className="object-cover" style={{ opacity: 0.8 }} />
                        )}
                        <div style={{
                          position: 'absolute', top: '12px', left: '12px',
                          background: C.gold, color: C.white, borderRadius: '6px',
                          padding: '6px 10px', textAlign: 'center',
                        }}>
                          <div style={{ fontFamily: font, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {formatMonth(ev.startTime)}
                          </div>
                          <div style={{ fontFamily: serif, fontSize: '26px', fontWeight: 500, lineHeight: 1 }}>
                            {formatDay(ev.startTime)}
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: '18px 20px', flex: 1 }}>
                        <div style={{ fontFamily: font, fontSize: '16px', fontWeight: 500, color: C.charcoal, marginBottom: '6px' }}>{ev.title}</div>
                        <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.7 }}>
                          🕖 {formatTime(ev.startTime)} – {formatTime(ev.endTime)}<br />
                          {ev.location && <>📍 {ev.location}<br /></>}
                          {spotsLeft !== null && <>👥 {spotsLeft > 0 ? `${spotsLeft} spots remaining` : 'Sold out'}</>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                          {tier && (
                            <div style={{ fontFamily: serif, fontSize: '20px', fontWeight: 500, color: C.charcoal }}>
                              {formatPrice(tier.price)} / person
                            </div>
                          )}
                          <a href="#" style={{
                            padding: '8px 18px', background: C.gold, color: C.white,
                            fontFamily: font, fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                            borderRadius: '8px', textDecoration: 'none', transition: 'background 0.3s',
                          }}>
                            Register
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SOUL TOURS ─────────────────────────────────────────── */}
          {guide.soulTours && guide.soulTours.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <SectionTitle>Soul Tours with {guide.displayName.split(' ')[0]}</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {guide.soulTours.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tours/${t.slug}`}
                    style={{
                      background: C.white, border: '1px solid rgba(232,184,75,0.15)',
                      borderRadius: '10px', overflow: 'hidden', display: 'flex', gap: 0,
                      textDecoration: 'none', color: 'inherit', transition: 'box-shadow 0.3s',
                    }}
                  >
                    <div style={{
                      width: '180px', flexShrink: 0,
                      background: t.coverImageUrl
                        ? `url(${t.coverImageUrl}) center/cover`
                        : 'linear-gradient(135deg, #2C2420, #3A3530)',
                      position: 'relative', minHeight: '160px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '48px', color: 'rgba(255,255,255,0.4)',
                    }}>
                      {!t.coverImageUrl && '🏔️'}
                      <div style={{
                        position: 'absolute', top: '12px', left: '12px',
                        background: 'rgba(232,184,75,0.95)', color: C.charcoal, borderRadius: '6px',
                        padding: '5px 10px', fontFamily: font, fontSize: '10px', fontWeight: 600,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        Soul Tour
                      </div>
                    </div>
                    <div style={{ padding: '18px 22px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: serif, fontSize: '20px', fontWeight: 500, color: C.charcoal, marginBottom: '4px' }}>
                          {t.title}
                        </div>
                        {t.shortDesc && (
                          <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.6, marginBottom: '10px' }}>
                            {t.shortDesc}
                          </div>
                        )}
                        <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.7 }}>
                          📅 {formatDate(t.nextDepartureStart)} – {formatDate(t.nextDepartureEnd)}<br />
                          {t.location && <>📍 {t.location}<br /></>}
                          👥 {t.spotsRemaining > 0 ? `${t.spotsRemaining} spots remaining` : 'Sold out'}
                          {t.difficultyLevel && <> · <span style={{ textTransform: 'capitalize' }}>{t.difficultyLevel.toLowerCase()}</span></>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
                        <div>
                          <div style={{ fontFamily: font, fontSize: '10px', color: C.warmGray, letterSpacing: '0.06em', textTransform: 'uppercase' }}>From</div>
                          <div style={{ fontFamily: serif, fontSize: '22px', fontWeight: 500, color: C.charcoal }}>
                            ${Number(t.startingPrice).toLocaleString()} <span style={{ fontSize: '11px', fontFamily: font, color: C.warmGray, fontWeight: 400 }}>/ person</span>
                          </div>
                        </div>
                        <span style={{
                          padding: '8px 18px', background: C.gold, color: C.white,
                          fontFamily: font, fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                          borderRadius: '8px',
                        }}>
                          View Journey →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── BLOG POSTS ─────────────────────────────────────────── */}
          {guide.blogPosts.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <SectionTitle>From {guide.displayName.split(' ')[0]}&apos;s Journal</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {guide.blogPosts.slice(0, 4).map((post) => (
                  <Link key={post.id} href={`/journal/${guide.slug}/${post.slug}`} style={{
                    background: C.white, border: '1px solid rgba(232,184,75,0.12)',
                    borderRadius: '10px', overflow: 'hidden', textDecoration: 'none', color: 'inherit',
                    transition: 'box-shadow 0.3s, transform 0.3s', display: 'block',
                  }}>
                    <div style={{ height: '160px', overflow: 'hidden', background: C.goldPale, position: 'relative' }}>
                      {post.coverImageUrl ? (
                        <Image src={post.coverImageUrl} alt="" fill sizes="350px" className="object-cover" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>✍️</div>
                      )}
                    </div>
                    <div style={{ padding: '18px' }}>
                      <div style={{ fontFamily: serif, fontSize: '18px', fontWeight: 500, color: C.charcoal, marginBottom: '8px', lineHeight: 1.3 }}>
                        {post.title}
                      </div>
                      {post.excerpt && (
                        <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.6, marginBottom: '12px' }}>
                          {post.excerpt.substring(0, 120)}...
                        </div>
                      )}
                      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, letterSpacing: '0.05em' }}>
                        {formatDate(post.publishedAt)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {guide.blogPosts.length > 4 && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <Link href={`/journal?guide=${guide.slug}`} style={{
                    fontFamily: font, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: C.warmGray, textDecoration: 'none', borderBottom: '1px solid rgba(138,130,120,0.4)', paddingBottom: '2px',
                  }}>
                    View All Posts →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ── REVIEWS ────────────────────────────────────────────── */}
          {(rs.totalReviews > 0 || guide.reviews.length > 0) && (
            <div style={{ marginBottom: '40px' }}>
              <SectionTitle>Reviews</SectionTitle>

              {/* Rating summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontFamily: serif, fontSize: '56px', fontWeight: 400, color: C.charcoal, lineHeight: 1 }}>
                    {rs.averageRating || '—'}
                  </div>
                  <div style={{ color: C.gold, fontSize: '20px', letterSpacing: '3px', marginBottom: '4px' }}>
                    {'★'.repeat(Math.round(rs.averageRating))}{'☆'.repeat(5 - Math.round(rs.averageRating))}
                  </div>
                  <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>{rs.totalReviews} reviews</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = rs.ratingDistribution[star] || 0;
                    const pct = rs.totalReviews > 0 ? (count / rs.totalReviews) * 100 : 0;
                    return (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, width: '16px', textAlign: 'right' }}>{star}</span>
                        <div style={{ flex: 1, height: '6px', background: C.offWhite, borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: C.gold, borderRadius: '3px', width: `${pct}%` }} />
                        </div>
                        <span style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, width: '20px' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual reviews */}
              {guide.reviews.map((r) => (
                <div key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', background: C.goldPale,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                      overflow: 'hidden',
                    }}>
                      {r.author.avatarUrl ? (
                        <Image src={r.author.avatarUrl} alt="" width={36} height={36} className="object-cover" style={{ borderRadius: '50%' }} />
                      ) : (
                        <span>{r.author.firstName[0]}</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>
                        {r.author.firstName} {r.author.lastName[0]}.
                      </div>
                      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{formatDate(r.createdAt)}</div>
                    </div>
                    <div style={{ color: C.gold, fontSize: '13px', letterSpacing: '2px', marginLeft: 'auto' }}>
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </div>
                  </div>
                  {r.body && (
                    <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.65, fontStyle: 'italic' }}>
                      &ldquo;{r.body}&rdquo;
                    </div>
                  )}
                </div>
              ))}

              {/* Verified notice */}
              <div style={{
                marginTop: '14px', padding: '10px 14px',
                background: C.goldPale, border: '1px solid rgba(232,184,75,0.25)', borderRadius: '8px',
                fontFamily: font, fontSize: '11px', color: C.warmGray,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ fontSize: '14px' }}>✓</span>
                All reviews are from verified clients who have completed a paid session or purchased a product.
              </div>
            </div>
          )}

          {/* ── TESTIMONIALS ───────────────────────────────────────── */}
          {guide.testimonials.length > 0 && (
            <div style={{ marginTop: '48px' }}>
              <div style={{
                fontFamily: font, fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
                color: C.gold, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                ✦ Peer Recognition <span style={{ flex: 1, height: '1px', background: 'rgba(232,184,75,0.25)' }} />
              </div>
              <h2 style={{ fontFamily: serif, fontSize: '32px', fontWeight: 400, color: C.charcoal, marginBottom: '24px' }}>
                What Colleagues Say
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {guide.testimonials.map((t) => (
                  <div key={t.id} style={{
                    background: C.white, border: '1px solid rgba(232,184,75,0.12)',
                    borderRadius: '12px', padding: '24px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px', flexShrink: 0, overflow: 'hidden',
                      }}>
                        {t.author.avatarUrl ? (
                          <Image src={t.author.avatarUrl} alt="" width={48} height={48} className="object-cover" style={{ borderRadius: '50%' }} />
                        ) : (
                          <span>{t.author.firstName[0]}</span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>
                          {t.author.firstName} {t.author.lastName}
                        </div>
                      </div>
                    </div>
                    <p style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, lineHeight: 1.7, fontStyle: 'italic' }}>
                      &ldquo;{t.body}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <div>

          {/* ── BOOKING WIDGET ──────────────────────────────────── */}
          <Widget title="📅 Book a Session">
            <div id="booking" style={{
              background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)',
              borderRadius: '8px', padding: '24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🗓️</div>
              <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6, marginBottom: '14px' }}>
                View {guide.displayName.split(' ')[0]}&apos;s real-time availability and book a session directly.
              </p>
              <a href={`/book/${guide.slug}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '11px 22px', background: C.gold, color: C.white,
                fontFamily: font, fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
                border: 'none', borderRadius: '6px', textDecoration: 'none', transition: 'background 0.3s',
              }}>
                Book a Session
              </a>
            </div>
          </Widget>

          {/* ── PRODUCTS ────────────────────────────────────────── */}
          {guide.products.length > 0 && (
            <Widget title="🛍️ Products">
              {guide.products.map((p) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 0', borderBottom: '1px solid rgba(232,184,75,0.1)',
                }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '6px',
                    background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', flexShrink: 0, overflow: 'hidden',
                  }}>
                    {p.imageUrls[0] ? (
                      <Image src={p.imageUrls[0]} alt="" width={52} height={52} className="object-cover" style={{ borderRadius: '6px' }} />
                    ) : (
                      p.type === 'DIGITAL' ? '🎵' : '📦'
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal, marginBottom: '2px' }}>{p.name}</div>
                    <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>
                      {p.type === 'DIGITAL' ? 'Digital Download' : 'Physical'} · {formatPrice(p.price)}
                    </div>
                  </div>
                  <button style={{
                    marginLeft: 'auto', padding: '6px 14px',
                    background: C.goldPale, border: '1px solid rgba(232,184,75,0.5)',
                    borderRadius: '6px', fontFamily: font, fontSize: '11px', fontWeight: 500, color: C.charcoal,
                    cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                  }}>
                    Buy
                  </button>
                </div>
              ))}
            </Widget>
          )}

          {/* ── CERTIFICATIONS ──────────────────────────────────── */}
          {guide.credentials.length > 0 && (
            <Widget title="🎓 Certifications">
              {guide.credentials.map((c) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '12px 0', borderBottom: '1px solid rgba(232,184,75,0.1)',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '8px',
                    background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', flexShrink: 0,
                  }}>
                    🏅
                  </div>
                  <div>
                    <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal, marginBottom: '2px' }}>{c.title}</div>
                    <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>
                      {c.institution}{c.issuedYear ? ` · ${c.issuedYear}` : ''}
                    </div>
                    {(c.verificationStatus === 'APPROVED') && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: font, fontSize: '10px', color: C.green, marginTop: '3px' }}>
                        ✓ Verified by Spiritual California
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Widget>
          )}

          {/* ── CONNECT ────────────────────────────────────────── */}
          {(guide.websiteUrl || guide.instagramUrl || guide.location) && (
            <Widget title="🔗 Connect">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {guide.websiteUrl && (
                  <a href={guide.websiteUrl} target="_blank" rel="noopener noreferrer" style={{
                    fontFamily: font, fontSize: '13px', color: C.warmGray, textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s',
                  }}>
                    🌐 {guide.websiteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                )}
                {guide.instagramUrl && (
                  <a href={guide.instagramUrl} target="_blank" rel="noopener noreferrer" style={{
                    fontFamily: font, fontSize: '13px', color: C.warmGray, textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s',
                  }}>
                    📸 {guide.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')}
                  </a>
                )}
                {guide.location && (
                  <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📍 {guide.location}
                  </div>
                )}
              </div>
            </Widget>
          )}

        </div>
      </div>

      <Footer />

      {/* ── Responsive + Badge Styles ──────────────────────────────── */}
      <style>{`
        .badge-online { background: #E8F5E9; color: #2E7D32; border: 1px solid #A5D6A7; }
        .badge-offline { background: #FFF3E0; color: #E65100; border: 1px solid #FFCC80; }
        .badge-both { background: #FDF6E3; color: #3A3530; border: 1px solid rgba(232,184,75,0.4); }
        @media (max-width: 900px) {
          .profile-body-grid { grid-template-columns: 1fr !important; padding: 24px 20px !important; }
          .profile-meta { flex-direction: column !important; padding-left: 24px !important; padding-top: 90px !important; }
          .profile-ctas { flex-direction: row !important; flex-wrap: wrap !important; min-width: auto !important; }
        }
      `}</style>
    </div>
  );
}
