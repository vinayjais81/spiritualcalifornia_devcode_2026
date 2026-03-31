import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from '@/components/public/layout/Navbar';
import { Footer } from '@/components/public/layout/Footer';

export const metadata = {
  title: 'About Us | Spiritual California',
  description: 'Learn how Spiritual California is building a trusted, verified marketplace connecting seekers with authentic wellness practitioners.',
};

const G = {
  gold:     '#E8B84B',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
  white:    '#FFFFFF',
};

const VALUES = [
  {
    icon: '🛡️',
    title: 'Trust Through Verification',
    body: 'Every Guide on our platform undergoes identity verification and credential review before receiving their verified badge. We use AI-powered document analysis and third-party identity services so you can engage with confidence.',
  },
  {
    icon: '🌿',
    title: 'Authentic Community',
    body: 'We curate practitioners who bring genuine expertise and lived experience to their work. Our peer-review system allows verified Guides to recognise one another, creating a layered trust network that goes beyond credentials.',
  },
  {
    icon: '🌏',
    title: 'Inclusive Access',
    body: 'Wellness is for everyone. We actively cultivate diversity across modalities, traditions, price points, and languages — because healing looks different for every person on every path.',
  },
  {
    icon: '✨',
    title: 'Transformative Impact',
    body: 'Beyond connecting individuals, we measure success by the depth of transformation our community enables. Every verified session, every soul travel, every product sold is a step toward a more conscious California.',
  },
];

const SEEKER_STEPS = [
  { step: '01', title: 'Describe what you\'re seeking', body: 'Share what\'s on your mind with our AI guide — burnout, anxiety, curiosity, or growth. It finds the right practitioners, events, and products for your path.' },
  { step: '02', title: 'Discover verified practitioners', body: 'Browse profiles of vetted Guides with verified credentials, real reviews from past clients, and transparent service pricing.' },
  { step: '03', title: 'Book, attend, transform', body: 'Schedule sessions, join events, or order products — all on one platform with secure payment and a support team watching over every interaction.' },
];

const GUIDE_STEPS = [
  { step: '01', title: 'Register & verify your identity', body: 'Complete our structured onboarding — including government ID verification and credential upload — to receive your verified practitioner badge.' },
  { step: '02', title: 'Build your presence', body: 'Create a rich profile with your bio, story, services, pricing, and product listings. Your verified badge signals trust before a Seeker even reads your first sentence.' },
  { step: '03', title: 'Grow your practice', body: 'Manage bookings via calendar integration, host virtual and in-person events, sell digital and physical products, and receive direct payouts — all from one hub.' },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: G.offWhite, display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 140, paddingBottom: 80, maxWidth: 900, margin: '0 auto', padding: '140px 32px 80px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: G.gold, marginBottom: 16 }}>
          Our Story
        </p>
        <h1 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(42px, 6vw, 72px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.1, marginBottom: 24 }}>
          Wellness deserves<br />
          <em style={{ fontStyle: 'italic', color: G.gold }}>trust</em>
        </h1>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 17, color: G.warmGray, lineHeight: 1.8, maxWidth: 640, margin: '0 auto 48px' }}>
          California has long been a crucible for spiritual exploration — from the redwood retreats of Big Sur to the yoga studios of Venice Beach. Yet for decades, finding a genuinely qualified practitioner meant navigating an unverified, fragmented market built on hope rather than evidence.
        </p>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 17, color: G.warmGray, lineHeight: 1.8, maxWidth: 640, margin: '0 auto' }}>
          Spiritual California was built to change that. We are a curated, two-sided marketplace where every Guide is verified, every interaction is protected, and every Seeker can explore with confidence.
        </p>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,184,75,0.4), transparent)' }} />
      </div>

      {/* ── THE PROBLEM ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 14 }}>
            The Problem We Solve
          </p>
          <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(30px, 4vw, 46px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.2, marginBottom: 24 }}>
            A market built on<br /><em style={{ fontStyle: 'italic', color: G.gold }}>fragmentation</em>
          </h2>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: G.warmGray, lineHeight: 1.8, marginBottom: 16 }}>
            Millions of people across California are experiencing sub-clinical challenges — burnout, anxiety, a lack of meaning — and turning to spiritual and wellness practitioners for support.
          </p>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: G.warmGray, lineHeight: 1.8, marginBottom: 16 }}>
            But the market they encounter is fragmented, unverified, and inconsistent. Practitioner credentials are self-reported. Reviews can be manipulated. Payment is handled off-platform. There is no single, trusted destination.
          </p>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: G.warmGray, lineHeight: 1.8 }}>
            Meanwhile, talented Guides struggle to build their digital presence, attract the right clients, and manage their business without a prohibitive tech stack.
          </p>
        </div>
        <div style={{ background: G.white, borderRadius: 16, padding: 40, border: '1px solid rgba(232,184,75,0.15)' }}>
          {[
            { n: '40M+', label: 'Americans actively seek spiritual or wellness support each year' },
            { n: '$6T', label: 'Global wellness market with minimal quality verification' },
            { n: '78%', label: 'Of seekers report difficulty finding verified, trustworthy practitioners' },
            { n: '1 platform', label: 'Needed to bring trust, discovery, and commerce together' },
          ].map(({ n, label }) => (
            <div key={n} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid rgba(232,184,75,0.1)', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 36, fontWeight: 400, color: G.gold, lineHeight: 1, flexShrink: 0 }}>{n}</div>
              <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.warmGray, lineHeight: 1.6, margin: '6px 0 0' }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────────── */}
      <section style={{ background: G.charcoal, padding: '80px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 14 }}>
              What We Stand For
            </p>
            <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: G.white, lineHeight: 1.2 }}>
              Our core <em style={{ fontStyle: 'italic', color: G.gold }}>values</em>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {VALUES.map((v) => (
              <div key={v.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12, padding: 32 }}>
                <div style={{ fontSize: 28, marginBottom: 16 }}>{v.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 22, fontWeight: 400, color: G.white, marginBottom: 12, lineHeight: 1.2 }}>{v.title}</h3>
                <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 14 }}>
            How It Works
          </p>
          <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.2 }}>
            Simple for <em style={{ fontStyle: 'italic', color: G.gold }}>everyone</em>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          {/* Seeker side */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: G.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌱</div>
              <h3 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 24, fontWeight: 400, color: G.charcoal }}>For Seekers</h3>
            </div>
            {SEEKER_STEPS.map((s) => (
              <div key={s.step} style={{ display: 'flex', gap: 20, marginBottom: 32 }}>
                <div style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 28, color: 'rgba(232,184,75,0.3)', fontWeight: 400, lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>{s.step}</div>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, fontWeight: 500, color: G.charcoal, marginBottom: 6, letterSpacing: '0.01em' }}>{s.title}</h4>
                  <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.warmGray, lineHeight: 1.7 }}>{s.body}</p>
                </div>
              </div>
            ))}
            <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: G.charcoal, color: G.white, padding: '12px 28px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Start Your Journey →
            </Link>
          </div>

          {/* Guide side */}
          <div style={{ borderLeft: '1px solid rgba(232,184,75,0.15)', paddingLeft: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(232,184,75,0.15)', border: `1px solid ${G.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌿</div>
              <h3 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 24, fontWeight: 400, color: G.charcoal }}>For Guides</h3>
            </div>
            {GUIDE_STEPS.map((s) => (
              <div key={s.step} style={{ display: 'flex', gap: 20, marginBottom: 32 }}>
                <div style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 28, color: 'rgba(232,184,75,0.3)', fontWeight: 400, lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>{s.step}</div>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, fontWeight: 500, color: G.charcoal, marginBottom: 6 }}>{s.title}</h4>
                  <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.warmGray, lineHeight: 1.7 }}>{s.body}</p>
                </div>
              </div>
            ))}
            <Link href="/onboarding/guide" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${G.gold}`, color: G.gold, padding: '12px 28px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
              List Your Practice →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ background: 'rgba(232,184,75,0.06)', borderTop: '1px solid rgba(232,184,75,0.15)', borderBottom: '1px solid rgba(232,184,75,0.15)', padding: '72px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 16 }}>Join the Community</p>
        <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: G.charcoal, marginBottom: 16 }}>
          Ready to begin your <em style={{ fontStyle: 'italic', color: G.gold }}>journey?</em>
        </h2>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.warmGray, marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
          Whether you're seeking guidance or offering it, Spiritual California is the trusted home for your path.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ background: G.charcoal, color: G.white, padding: '14px 36px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Find a Guide
          </Link>
          <Link href="/onboarding/guide" style={{ border: `1px solid ${G.charcoal}`, color: G.charcoal, padding: '14px 36px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Become a Guide
          </Link>
          <Link href="/contact" style={{ color: G.warmGray, padding: '14px 36px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Contact Us →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
