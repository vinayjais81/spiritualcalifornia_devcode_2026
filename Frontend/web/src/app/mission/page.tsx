import Link from 'next/link';
import { Navbar } from '@/components/public/layout/Navbar';
import { Footer } from '@/components/public/layout/Footer';

export const metadata = {
  title: 'Our Mission | Spiritual California',
  description: 'Spiritual California\'s mission: building a single trusted destination for mind, body and soul — where verification, community, and transformation converge.',
};

const G = {
  gold:     '#E8B84B',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
  white:    '#FFFFFF',
};

const PRINCIPLES = [
  {
    title: 'Verification First',
    body: 'We verify before we list. Identity documents, practitioner credentials, and institutional references are reviewed — by AI and by humans — before any Guide goes live on the platform.',
  },
  {
    title: 'Radical Transparency',
    body: 'Pricing, credentials, reviews, and verification status are visible on every Guide profile. Seekers can make informed decisions without deciphering vague bios and self-awarded titles.',
  },
  {
    title: 'Community Accountability',
    body: 'Only verified, paying clients can leave reviews. Guides can write peer testimonials for one another. Two layers of trust, built from real interactions rather than algorithms.',
  },
  {
    title: 'Inclusive Modalities',
    body: 'We honour every lineage — from Ayurvedic medicine and Tibetan healing to somatic work, plant medicine, and life coaching. Healing is not one size; our platform reflects that reality.',
  },
  {
    title: 'Practitioner Success',
    body: 'Guides deserve a business infrastructure as thoughtful as their practice. We provide calendar management, event hosting, e-commerce, and financial tools so they can focus on healing, not admin.',
  },
  {
    title: 'Long-Term Trust',
    body: 'We are building for decades, not months. Every product decision is weighed against the question: does this deepen or diminish the trust seekers place in this platform?',
  },
];

const CATEGORIES = [
  { icon: '🧠', name: 'Mind Healing', sub: 'Meditation, Hypnotherapy, NLP, Mindfulness, Psychotherapy' },
  { icon: '🌿', name: 'Body Healing', sub: 'Yoga, Reiki, QiGong, Energy Healing, Massage, Herbalism, Acupuncture' },
  { icon: '✈️', name: 'Soul Travels', sub: 'Spiritual Retreats, Cultural Immersions, Nature-Based Healing Trips' },
  { icon: '🎯', name: 'Life Coaching', sub: 'Career, Relationship, Executive & Purpose Coaching' },
  { icon: '🎨', name: 'Creative Arts', sub: 'Art Therapy, Music Therapy, Expressive Dance' },
];

export default function MissionPage() {
  return (
    <div style={{ minHeight: '100vh', background: G.offWhite, display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 140, paddingBottom: 72, textAlign: 'center', padding: '140px 32px 72px', maxWidth: 820, margin: '0 auto' }}>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: G.gold, marginBottom: 16 }}>
          Our Mission
        </p>
        <h1 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.1, marginBottom: 28 }}>
          A single trusted destination<br />for <em style={{ fontStyle: 'italic', color: G.gold }}>mind, body &amp; soul</em>
        </h1>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 18, color: G.warmGray, lineHeight: 1.8, maxWidth: 640, margin: '0 auto' }}>
          We exist to create the most trusted wellness marketplace in California — a place where Seekers can engage with verified practitioners and where Guides can build meaningful, sustainable practices.
        </p>
      </section>

      {/* ── THE PROBLEM ──────────────────────────────────────────────────── */}
      <section style={{ background: G.charcoal, padding: '80px 32px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 16 }}>
              The Problem
            </p>
            <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, color: G.white, lineHeight: 1.2, marginBottom: 24 }}>
              A fragmented market<br />built on <em style={{ fontStyle: 'italic', color: G.gold }}>unverified claims</em>
            </h2>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: 16 }}>
              Millions of Californians are navigating burnout, anxiety, and a deep search for meaning. They are turning to spiritual and wellness practitioners in record numbers — but the market they encounter offers no reliable quality signal.
            </p>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
              Credentials are self-reported. Platforms designed for mainstream services have no framework for verifying a Reiki healer or an Ayurvedic practitioner. Reviews are unverified. The result is an industry where scam sits alongside genuine mastery — and the Seeker has no way to know the difference.
            </p>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 16 }}>
              Our Solution
            </p>
            <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, color: G.white, lineHeight: 1.2, marginBottom: 24 }}>
              Curated, verified,<br /><em style={{ fontStyle: 'italic', color: G.gold }}>community-driven</em>
            </h2>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: 16 }}>
              Spiritual California operates a rigorous verification pipeline: every Guide submits government-issued ID and practice credentials, which are processed by AI-powered document analysis before passing human review. A verified badge is earned, not purchased.
            </p>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
              We then layer community accountability — verified client reviews, peer Guide testimonials, and an AI-powered discovery system — to surface the most relevant, trustworthy Guides for each unique Seeker's path.
            </p>
          </div>
        </div>
      </section>

      {/* ── VISION ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 16 }}>
          The Vision
        </p>
        <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.2, marginBottom: 28 }}>
          A world where seeking is <em style={{ fontStyle: 'italic', color: G.gold }}>safe</em>
        </h2>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 16, color: G.warmGray, lineHeight: 1.8, marginBottom: 20 }}>
          We envision a California — and eventually a world — where anyone experiencing burnout, anxiety, or spiritual hunger can find a genuinely qualified practitioner as easily as they book a restaurant reservation.
        </p>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 16, color: G.warmGray, lineHeight: 1.8, marginBottom: 20 }}>
          Where Guides of every tradition and background have the business infrastructure to serve their clients with dignity. Where the $6 trillion wellness economy flows toward practitioners who have earned trust rather than those who have merely paid for visibility.
        </p>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 16, color: G.warmGray, lineHeight: 1.8 }}>
          That is the platform we are building. Every feature, every policy, and every partnership is weighed against that north star.
        </p>
      </section>

      {/* ── PRINCIPLES ───────────────────────────────────────────────────── */}
      <section style={{ background: 'rgba(232,184,75,0.04)', borderTop: '1px solid rgba(232,184,75,0.15)', borderBottom: '1px solid rgba(232,184,75,0.15)', padding: '80px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 14 }}>
              Our Principles
            </p>
            <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.2 }}>
              How we <em style={{ fontStyle: 'italic', color: G.gold }}>operate</em>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} style={{ display: 'flex', gap: 20 }}>
                <div style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 32, color: 'rgba(232,184,75,0.35)', lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, fontWeight: 600, color: G.charcoal, marginBottom: 8, letterSpacing: '0.02em' }}>{p.title}</h3>
                  <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.warmGray, lineHeight: 1.7 }}>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 14 }}>
            What We Cover
          </p>
          <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.2 }}>
            Five pillars of <em style={{ fontStyle: 'italic', color: G.gold }}>wellbeing</em>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {CATEGORIES.map((c) => (
            <div key={c.name} style={{ background: G.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12, padding: 28, textAlign: 'center', transition: 'border-color 0.3s' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{c.icon}</div>
              <h3 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 20, fontWeight: 400, color: G.charcoal, marginBottom: 8 }}>{c.name}</h3>
              <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, color: G.warmGray, lineHeight: 1.6 }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ background: G.charcoal, padding: '72px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 16 }}>
          Join the Mission
        </p>
        <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: G.white, marginBottom: 16, lineHeight: 1.2 }}>
          This work belongs to all of <em style={{ fontStyle: 'italic', color: G.gold }}>us</em>
        </h2>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 40, maxWidth: 520, margin: '0 auto 40px' }}>
          Whether you are a Seeker finding your path or a Guide ready to share yours, the mission only works if we build it together.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ background: G.gold, color: G.charcoal, padding: '14px 36px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Find a Guide
          </Link>
          <Link href="/onboarding/guide" style={{ border: '1px solid rgba(255,255,255,0.25)', color: G.white, padding: '14px 36px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Become a Guide
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
