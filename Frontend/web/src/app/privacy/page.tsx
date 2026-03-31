import Link from 'next/link';
import Image from 'next/image';

const G = {
  gold:     '#E8B84B',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
};

export const metadata = {
  title: 'Privacy Policy | Spiritual California',
  description: 'Privacy Policy for the Spiritual California marketplace platform.',
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.warmGray, marginBottom: 48 }}>
          Last updated: March 18, 2026
        </p>

        <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, lineHeight: 1.8, color: G.charcoal }}>

          <Section title="1. Introduction">
            Spiritual California ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our platform. Please read this policy carefully. By using the Platform, you consent to the data practices described in this policy.
          </Section>

          <Section title="2. Information We Collect">
            <p><strong>Information you provide directly:</strong></p>
            <ul style={{ paddingLeft: 20, marginTop: 8, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Account registration data (name, email address, password)</li>
              <li>Profile information (bio, profile photo, location, languages, social links)</li>
              <li>Guide credentials and verification documents</li>
              <li>Payment information (processed securely by Stripe — we do not store card details)</li>
              <li>Communications you send to us or through the Platform</li>
            </ul>
            <p><strong>Information collected automatically:</strong></p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Log data (IP address, browser type, pages visited, time spent)</li>
              <li>Device information (device type, operating system)</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Usage patterns and interaction data</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Create and manage your account</li>
              <li>Facilitate bookings and transactions between Seekers and Guides</li>
              <li>Verify Guide identity and credentials</li>
              <li>Send transactional emails (booking confirmations, receipts, verification updates)</li>
              <li>Personalize your experience and surface relevant Guides and services</li>
              <li>Improve and develop the Platform</li>
              <li>Comply with legal obligations</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </Section>

          <Section title="4. Information Sharing">
            <p>We do not sell your personal information. We may share information in the following circumstances:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong>With Guides/Seekers:</strong> Profile information is shared as necessary to facilitate bookings</li>
              <li><strong>Service providers:</strong> We work with trusted third-party providers (Stripe for payments, AWS for storage, Persona for identity verification, Resend for email delivery) who process data on our behalf under strict confidentiality agreements</li>
              <li><strong>Legal compliance:</strong> When required by law, court order, or governmental authority</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </Section>

          <Section title="5. Cookies and Tracking">
            We use cookies and similar technologies to maintain your session, remember your preferences, and analyze Platform usage. You can control cookie settings through your browser. Disabling certain cookies may affect Platform functionality.
          </Section>

          <Section title="6. Data Retention">
            We retain your personal information for as long as your account is active or as needed to provide services, comply with legal obligations, resolve disputes, and enforce our agreements. You may request deletion of your account and associated data at any time by contacting us.
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict processing of your data</li>
              <li>Request portability of your data</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p style={{ marginTop: 12 }}>To exercise these rights, contact us at <a href="mailto:privacy@spiritualcalifornia.com" style={{ color: G.gold, textDecoration: 'none' }}>privacy@spiritualcalifornia.com</a>.</p>
          </Section>

          <Section title="8. California Privacy Rights (CCPA)">
            California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete personal information, the right to opt out of the sale of personal information (we do not sell personal information), and the right to non-discrimination for exercising privacy rights.
          </Section>

          <Section title="9. Data Security">
            We implement industry-standard security measures including encryption in transit (TLS), encrypted storage, access controls, and regular security audits. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </Section>

          <Section title="10. Third-Party Links">
            The Platform may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies.
          </Section>

          <Section title="11. Children's Privacy">
            The Platform is not intended for individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that we have collected data from a minor, we will take steps to delete it promptly.
          </Section>

          <Section title="12. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will notify you of material changes via email or a prominent notice on the Platform. The "Last updated" date at the top of this page reflects when the policy was last revised.
          </Section>

          <Section title="13. Contact Us">
            <p>If you have questions or concerns about this Privacy Policy or our data practices, please contact:</p>
            <p style={{ marginTop: 8, color: G.warmGray }}>
              Spiritual California — Privacy Team<br />
              <a href="mailto:privacy@spiritualcalifornia.com" style={{ color: G.gold, textDecoration: 'none' }}>privacy@spiritualcalifornia.com</a>
            </p>
          </Section>

        </div>

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(232,184,75,0.2)', display: 'flex', gap: 24 }}>
          <Link href="/terms" style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.gold, textDecoration: 'none' }}>
            Terms of Service →
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
