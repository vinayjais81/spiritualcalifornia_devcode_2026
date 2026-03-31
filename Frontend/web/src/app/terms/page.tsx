import Link from 'next/link';
import Image from 'next/image';

const G = {
  gold:     '#E8B84B',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
};

export const metadata = {
  title: 'Terms of Service | Spiritual California',
  description: 'Terms of Service for the Spiritual California marketplace platform.',
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: G.offWhite, display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 48px',
        background: 'rgba(250,250,247,0.95)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(232,184,75,0.15)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Image src="/images/logo.jpg" alt="Spiritual California" width={36} height={36}
            style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 17, fontWeight: 500, color: G.charcoal }}>
              Spiritual California
            </span>
            <span style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.warmGray, marginTop: 2 }}>
              mind · body · soul
            </span>
          </div>
        </Link>
        <Link href="/" style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, color: G.charcoal, textDecoration: 'none', letterSpacing: '0.08em' }}>
          ← Back to Home
        </Link>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: 780, margin: '0 auto', padding: '64px 24px 96px', width: '100%' }}>

        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.gold, marginBottom: 12 }}>
          Legal
        </p>
        <h1 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.1, marginBottom: 8 }}>
          Terms of Service
        </h1>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.warmGray, marginBottom: 48 }}>
          Last updated: March 18, 2026
        </p>

        <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, lineHeight: 1.8, color: G.charcoal }}>

          <Section title="1. Acceptance of Terms">
            By accessing or using the Spiritual California platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform. These Terms apply to all visitors, Seekers, Guides, and any other users of the Platform.
          </Section>

          <Section title="2. Description of the Platform">
            Spiritual California is a curated marketplace connecting wellness seekers ("Seekers") with verified wellness practitioners ("Guides"). The Platform facilitates discovery, booking, and communication between Seekers and Guides for spiritual, wellness, and holistic services including, but not limited to, meditation, yoga, sound healing, energy work, and coaching.
          </Section>

          <Section title="3. Eligibility">
            You must be at least 18 years of age to use the Platform. By creating an account, you represent and warrant that you are 18 years of age or older and have the legal capacity to enter into these Terms.
          </Section>

          <Section title="4. User Accounts">
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Provide accurate and complete information during registration</li>
              <li>Keep your account information current and accurate</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
            </ul>
            <p style={{ marginTop: 12 }}>We reserve the right to suspend or terminate accounts that violate these Terms.</p>
          </Section>

          <Section title="5. Guide Verification">
            Guides are required to complete an identity verification and credential review process. Spiritual California verifies the identity of Guides and reviews submitted credentials; however, we do not independently verify the accuracy of all credential claims. Seekers are encouraged to review Guide profiles and exercise their own judgment when booking services.
          </Section>

          <Section title="6. Bookings and Payments">
            <p>All transactions between Seekers and Guides are processed through our secure payment system powered by Stripe. By using the Platform:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Seekers authorize payment at the time of booking</li>
              <li>Guides agree to provide services as described in their profile</li>
              <li>Cancellation and refund policies are governed by individual Guide policies and our platform refund guidelines</li>
              <li>Spiritual California collects a platform service fee on each transaction</li>
            </ul>
          </Section>

          <Section title="7. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Use the Platform for any unlawful purpose or in violation of any applicable laws</li>
              <li>Harass, threaten, or harm other users</li>
              <li>Post false, misleading, or fraudulent information</li>
              <li>Circumvent the Platform to conduct off-platform transactions with users you met through the Platform</li>
              <li>Scrape, crawl, or use automated means to access the Platform</li>
              <li>Impersonate any person or entity</li>
              <li>Upload or transmit any malicious code or content</li>
            </ul>
          </Section>

          <Section title="8. Content and Intellectual Property">
            You retain ownership of content you submit to the Platform. By submitting content, you grant Spiritual California a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content in connection with operating and promoting the Platform. You represent that you have all necessary rights to grant this license.
          </Section>

          <Section title="9. Disclaimers">
            The Platform is provided on an "as is" and "as available" basis. Spiritual California does not provide medical, psychological, legal, or financial advice. Wellness services offered by Guides are not a substitute for professional medical treatment. You use the Platform and engage with Guides at your own risk.
          </Section>

          <Section title="10. Limitation of Liability">
            To the maximum extent permitted by law, Spiritual California shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform or any services obtained through the Platform.
          </Section>

          <Section title="11. Changes to Terms">
            We may update these Terms from time to time. We will notify you of material changes via email or prominent notice on the Platform. Continued use of the Platform after changes become effective constitutes acceptance of the updated Terms.
          </Section>

          <Section title="12. Governing Law">
            These Terms are governed by the laws of the State of California, without regard to its conflict of law principles. Any disputes shall be resolved in the courts located in California.
          </Section>

          <Section title="13. Contact">
            <p>If you have questions about these Terms, please contact us at:</p>
            <p style={{ marginTop: 8, color: G.warmGray }}>
              Spiritual California<br />
              <a href="mailto:legal@spiritualcalifornia.com" style={{ color: G.gold, textDecoration: 'none' }}>legal@spiritualcalifornia.com</a>
            </p>
          </Section>

        </div>

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(232,184,75,0.2)', display: 'flex', gap: 24 }}>
          <Link href="/privacy" style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.gold, textDecoration: 'none' }}>
            Privacy Policy →
          </Link>
          <Link href="/" style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.warmGray, textDecoration: 'none' }}>
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{
        fontFamily: 'var(--font-cormorant-garamond), serif',
        fontSize: 22, fontWeight: 500, color: '#3A3530',
        marginBottom: 12, lineHeight: 1.3,
      }}>
        {title}
      </h2>
      <div style={{ color: '#3A3530', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}
