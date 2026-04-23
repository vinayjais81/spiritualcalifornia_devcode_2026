/**
 * Idempotent seed for the CMS `static_pages` table.
 *
 * Run with: `npx tsx prisma/seed-static-pages.ts` (or via the `seed:pages`
 * package.json script if configured). Safe to re-run — uses `upsert` so
 * admin edits made through the panel after the first run will be OVERWRITTEN.
 * Only run against fresh environments or when you explicitly want to reset
 * the CMS copy back to the canonical source-controlled version.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const PRIVACY_EMAIL =
  process.env.CONTACT_EMAIL_PRIVACY ?? 'privacy@spiritualcalifornia.com';
const LEGAL_EMAIL =
  process.env.CONTACT_EMAIL_LEGAL ?? 'legal@spiritualcalifornia.com';

// HTML bodies live as Tiptap-compatible markup so the admin rich-text editor
// can round-trip them without losing structure.
const PRIVACY_BODY = `
<h2>1. Introduction</h2>
<p>Spiritual California ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our platform. Please read this policy carefully. By using the Platform, you consent to the data practices described in this policy.</p>

<h2>2. Information We Collect</h2>
<p><strong>Information you provide directly:</strong></p>
<ul>
  <li>Account registration data (name, email address, password)</li>
  <li>Profile information (bio, profile photo, location, languages, social links)</li>
  <li>Guide credentials and verification documents</li>
  <li>Payment information (processed securely by Stripe — we do not store card details)</li>
  <li>Communications you send to us or through the Platform</li>
</ul>
<p><strong>Information collected automatically:</strong></p>
<ul>
  <li>Log data (IP address, browser type, pages visited, time spent)</li>
  <li>Device information (device type, operating system)</li>
  <li>Cookies and similar tracking technologies</li>
  <li>Usage patterns and interaction data</li>
</ul>

<h2>3. How We Use Your Information</h2>
<p>We use the information we collect to:</p>
<ul>
  <li>Create and manage your account</li>
  <li>Facilitate bookings and transactions between Seekers and Guides</li>
  <li>Verify Guide identity and credentials</li>
  <li>Send transactional emails (booking confirmations, receipts, verification updates)</li>
  <li>Personalize your experience and surface relevant Guides and services</li>
  <li>Improve and develop the Platform</li>
  <li>Comply with legal obligations</li>
  <li>Detect and prevent fraud or abuse</li>
</ul>

<h2>4. Information Sharing</h2>
<p>We do not sell your personal information. We may share information in the following circumstances:</p>
<ul>
  <li><strong>With Guides/Seekers:</strong> Profile information is shared as necessary to facilitate bookings</li>
  <li><strong>Service providers:</strong> We work with trusted third-party providers (Stripe for payments, AWS for storage, Persona for identity verification, Resend for email delivery) who process data on our behalf under strict confidentiality agreements</li>
  <li><strong>Legal compliance:</strong> When required by law, court order, or governmental authority</li>
  <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
</ul>

<h2>5. Cookies and Tracking</h2>
<p>We use cookies and similar technologies to maintain your session, remember your preferences, and analyze Platform usage. You can control cookie settings through your browser. Disabling certain cookies may affect Platform functionality.</p>

<h2>6. Data Retention</h2>
<p>We retain your personal information for as long as your account is active or as needed to provide services, comply with legal obligations, resolve disputes, and enforce our agreements. You may request deletion of your account and associated data at any time by contacting us.</p>

<h2>7. Your Rights</h2>
<p>Depending on your location, you may have the right to:</p>
<ul>
  <li>Access the personal information we hold about you</li>
  <li>Correct inaccurate or incomplete information</li>
  <li>Request deletion of your personal information</li>
  <li>Object to or restrict processing of your data</li>
  <li>Request portability of your data</li>
  <li>Withdraw consent where processing is based on consent</li>
</ul>
<p>To exercise these rights, contact us at <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a>.</p>

<h2>8. California Privacy Rights (CCPA)</h2>
<p>California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete personal information, the right to opt out of the sale of personal information (we do not sell personal information), and the right to non-discrimination for exercising privacy rights.</p>

<h2>9. Data Security</h2>
<p>We implement industry-standard security measures including encryption in transit (TLS), encrypted storage, access controls, and regular security audits. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>

<h2>10. Third-Party Links</h2>
<p>The Platform may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies.</p>

<h2>11. Children's Privacy</h2>
<p>The Platform is not intended for individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that we have collected data from a minor, we will take steps to delete it promptly.</p>

<h2>12. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or a prominent notice on the Platform. The "Last updated" date at the top of this page reflects when the policy was last revised.</p>

<h2>13. Contact Us</h2>
<p>If you have questions or concerns about this Privacy Policy or our data practices, please contact:</p>
<p>Spiritual California — Privacy Team<br /><a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a></p>
`.trim();

const ABOUT_BODY = `
<p><em>California has long been a crucible for spiritual exploration — from the redwood retreats of Big Sur to the yoga studios of Venice Beach. Yet for decades, finding a genuinely qualified practitioner meant navigating an unverified, fragmented market built on hope rather than evidence.</em></p>

<p><em>Spiritual California was built to change that. We are a curated, two-sided marketplace where every Guide is verified, every interaction is protected, and every Seeker can explore with confidence.</em></p>

<h2>The Problem We Solve</h2>
<p><strong>A market built on fragmentation.</strong></p>
<p>Millions of people across California are experiencing sub-clinical challenges — burnout, anxiety, a lack of meaning — and turning to spiritual and wellness practitioners for support.</p>
<p>But the market they encounter is fragmented, unverified, and inconsistent. Practitioner credentials are self-reported. Reviews can be manipulated. Payment is handled off-platform. There is no single, trusted destination.</p>
<p>Meanwhile, talented Guides struggle to build their digital presence, attract the right clients, and manage their business without a prohibitive tech stack.</p>
<p><strong>By the numbers:</strong></p>
<ul>
  <li><strong>40M+</strong> Americans actively seek spiritual or wellness support each year</li>
  <li><strong>$6T</strong> global wellness market with minimal quality verification</li>
  <li><strong>78%</strong> of seekers report difficulty finding verified, trustworthy practitioners</li>
  <li><strong>1 platform</strong> needed to bring trust, discovery, and commerce together</li>
</ul>

<h2>Our Core Values</h2>

<h3>🛡️ Trust Through Verification</h3>
<p>Every Guide on our platform undergoes identity verification and credential review before receiving their verified badge. We use AI-powered document analysis and third-party identity services so you can engage with confidence.</p>

<h3>🌿 Authentic Community</h3>
<p>We curate practitioners who bring genuine expertise and lived experience to their work. Our peer-review system allows verified Guides to recognise one another, creating a layered trust network that goes beyond credentials.</p>

<h3>🌏 Inclusive Access</h3>
<p>Wellness is for everyone. We actively cultivate diversity across modalities, traditions, price points, and languages — because healing looks different for every person on every path.</p>

<h3>✨ Transformative Impact</h3>
<p>Beyond connecting individuals, we measure success by the depth of transformation our community enables. Every verified session, every soul travel, every product sold is a step toward a more conscious California.</p>

<h2>How It Works</h2>

<h3>🌱 For Seekers</h3>
<ol>
  <li><strong>Describe what you're seeking.</strong> Share what's on your mind with our AI guide — burnout, anxiety, curiosity, or growth. It finds the right practitioners, events, and products for your path.</li>
  <li><strong>Discover verified practitioners.</strong> Browse profiles of vetted Guides with verified credentials, real reviews from past clients, and transparent service pricing.</li>
  <li><strong>Book, attend, transform.</strong> Schedule sessions, join events, or order products — all on one platform with secure payment and a support team watching over every interaction.</li>
</ol>
<p><a href="/register"><strong>Start your journey →</strong></a></p>

<h3>🌿 For Guides</h3>
<ol>
  <li><strong>Register &amp; verify your identity.</strong> Complete our structured onboarding — including government ID verification and credential upload — to receive your verified practitioner badge.</li>
  <li><strong>Build your presence.</strong> Create a rich profile with your bio, story, services, pricing, and product listings. Your verified badge signals trust before a Seeker even reads your first sentence.</li>
  <li><strong>Grow your practice.</strong> Manage bookings via calendar integration, host virtual and in-person events, sell digital and physical products, and receive direct payouts — all from one hub.</li>
</ol>
<p><a href="/onboarding/guide"><strong>List your practice →</strong></a></p>

<h2>Ready to begin your journey?</h2>
<p>Whether you're seeking guidance or offering it, Spiritual California is the trusted home for your path.</p>
<p><a href="/register"><strong>Find a Guide →</strong></a> &nbsp; <a href="/onboarding/guide"><strong>Become a Guide →</strong></a> &nbsp; <a href="/contact">Contact us</a></p>
`.trim();

const MISSION_BODY = `
<p><em>We exist to create the most trusted wellness marketplace in California — a place where Seekers can engage with verified practitioners and where Guides can build meaningful, sustainable practices.</em></p>

<h2>The Problem</h2>
<p><strong>A fragmented market built on unverified claims.</strong></p>
<p>Millions of Californians are navigating burnout, anxiety, and a deep search for meaning. They are turning to spiritual and wellness practitioners in record numbers — but the market they encounter offers no reliable quality signal.</p>
<p>Credentials are self-reported. Platforms designed for mainstream services have no framework for verifying a Reiki healer or an Ayurvedic practitioner. Reviews are unverified. The result is an industry where scam sits alongside genuine mastery — and the Seeker has no way to know the difference.</p>

<h2>Our Solution</h2>
<p><strong>Curated, verified, community-driven.</strong></p>
<p>Spiritual California operates a rigorous verification pipeline: every Guide submits government-issued ID and practice credentials, which are processed by AI-powered document analysis before passing human review. A verified badge is earned, not purchased.</p>
<p>We then layer community accountability — verified client reviews, peer Guide testimonials, and an AI-powered discovery system — to surface the most relevant, trustworthy Guides for each unique Seeker's path.</p>

<h2>The Vision</h2>
<p><strong>A world where seeking is safe.</strong></p>
<p>We envision a California — and eventually a world — where anyone experiencing burnout, anxiety, or spiritual hunger can find a genuinely qualified practitioner as easily as they book a restaurant reservation.</p>
<p>Where Guides of every tradition and background have the business infrastructure to serve their clients with dignity. Where the $6 trillion wellness economy flows toward practitioners who have earned trust rather than those who have merely paid for visibility.</p>
<p>That is the platform we are building. Every feature, every policy, and every partnership is weighed against that north star.</p>

<h2>Our Principles</h2>
<ol>
  <li><strong>Verification First.</strong> We verify before we list. Identity documents, practitioner credentials, and institutional references are reviewed — by AI and by humans — before any Guide goes live on the platform.</li>
  <li><strong>Radical Transparency.</strong> Pricing, credentials, reviews, and verification status are visible on every Guide profile. Seekers can make informed decisions without deciphering vague bios and self-awarded titles.</li>
  <li><strong>Community Accountability.</strong> Only verified, paying clients can leave reviews. Guides can write peer testimonials for one another. Two layers of trust, built from real interactions rather than algorithms.</li>
  <li><strong>Inclusive Modalities.</strong> We honour every lineage — from Ayurvedic medicine and Tibetan healing to somatic work, plant medicine, and life coaching. Healing is not one size; our platform reflects that reality.</li>
  <li><strong>Practitioner Success.</strong> Guides deserve a business infrastructure as thoughtful as their practice. We provide calendar management, event hosting, e-commerce, and financial tools so they can focus on healing, not admin.</li>
  <li><strong>Long-Term Trust.</strong> We are building for decades, not months. Every product decision is weighed against the question: does this deepen or diminish the trust seekers place in this platform?</li>
</ol>

<h2>Five Pillars of Wellbeing</h2>
<ul>
  <li><strong>🧠 Mind Healing</strong> — Meditation, Hypnotherapy, NLP, Mindfulness, Psychotherapy</li>
  <li><strong>🌿 Body Healing</strong> — Yoga, Reiki, QiGong, Energy Healing, Massage, Herbalism, Acupuncture</li>
  <li><strong>✈️ Soul Travels</strong> — Spiritual Retreats, Cultural Immersions, Nature-Based Healing Trips</li>
  <li><strong>🎯 Life Coaching</strong> — Career, Relationship, Executive &amp; Purpose Coaching</li>
  <li><strong>🎨 Creative Arts</strong> — Art Therapy, Music Therapy, Expressive Dance</li>
</ul>

<h2>This work belongs to all of us</h2>
<p>Whether you are a Seeker finding your path or a Guide ready to share yours, the mission only works if we build it together.</p>
<p><a href="/register"><strong>Find a Guide →</strong></a> &nbsp; <a href="/onboarding/guide"><strong>Become a Guide →</strong></a></p>
`.trim();

const TERMS_BODY = `
<h2>1. Acceptance of Terms</h2>
<p>By accessing or using the Spiritual California platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform. These Terms apply to all visitors, Seekers, Guides, and any other users of the Platform.</p>

<h2>2. Description of the Platform</h2>
<p>Spiritual California is a curated marketplace connecting wellness seekers ("Seekers") with verified wellness practitioners ("Guides"). The Platform facilitates discovery, booking, and communication between Seekers and Guides for spiritual, wellness, and holistic services including, but not limited to, meditation, yoga, sound healing, energy work, and coaching.</p>

<h2>3. Eligibility</h2>
<p>You must be at least 18 years of age to use the Platform. By creating an account, you represent and warrant that you are 18 years of age or older and have the legal capacity to enter into these Terms.</p>

<h2>4. User Accounts</h2>
<p>You are responsible for maintaining the confidentiality of your account credentials. You agree to:</p>
<ul>
  <li>Provide accurate and complete information during registration</li>
  <li>Keep your account information current and accurate</li>
  <li>Notify us immediately of any unauthorized use of your account</li>
  <li>Accept responsibility for all activity that occurs under your account</li>
</ul>
<p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>

<h2>5. Guide Verification</h2>
<p>Guides are required to complete an identity verification and credential review process. Spiritual California verifies the identity of Guides and reviews submitted credentials; however, we do not independently verify the accuracy of all credential claims. Seekers are encouraged to review Guide profiles and exercise their own judgment when booking services.</p>

<h2>6. Bookings and Payments</h2>
<p>All transactions between Seekers and Guides are processed through our secure payment system powered by Stripe. By using the Platform:</p>
<ul>
  <li>Seekers authorize payment at the time of booking</li>
  <li>Guides agree to provide services as described in their profile</li>
  <li>Cancellation and refund policies are governed by individual Guide policies and our platform refund guidelines</li>
  <li>Spiritual California collects a platform service fee on each transaction</li>
</ul>

<h2>7. Prohibited Conduct</h2>
<p>You agree not to:</p>
<ul>
  <li>Use the Platform for any unlawful purpose or in violation of any applicable laws</li>
  <li>Harass, threaten, or harm other users</li>
  <li>Post false, misleading, or fraudulent information</li>
  <li>Circumvent the Platform to conduct off-platform transactions with users you met through the Platform</li>
  <li>Scrape, crawl, or use automated means to access the Platform</li>
  <li>Impersonate any person or entity</li>
  <li>Upload or transmit any malicious code or content</li>
</ul>

<h2>8. Content and Intellectual Property</h2>
<p>You retain ownership of content you submit to the Platform. By submitting content, you grant Spiritual California a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content in connection with operating and promoting the Platform. You represent that you have all necessary rights to grant this license.</p>

<h2>9. Disclaimers</h2>
<p>The Platform is provided on an "as is" and "as available" basis. Spiritual California does not provide medical, psychological, legal, or financial advice. Wellness services offered by Guides are not a substitute for professional medical treatment. You use the Platform and engage with Guides at your own risk.</p>

<h2>10. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, Spiritual California shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform or any services obtained through the Platform.</p>

<h2>11. Changes to Terms</h2>
<p>We may update these Terms from time to time. We will notify you of material changes via email or prominent notice on the Platform. Continued use of the Platform after changes become effective constitutes acceptance of the updated Terms.</p>

<h2>12. Governing Law</h2>
<p>These Terms are governed by the laws of the State of California, without regard to its conflict of law principles. Any disputes shall be resolved in the courts located in California.</p>

<h2>13. Contact</h2>
<p>If you have questions about these Terms, please contact us at:</p>
<p>Spiritual California<br /><a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a></p>
`.trim();

async function main() {
  const now = new Date();

  const privacy = await prisma.staticPage.upsert({
    where: { slug: 'privacy' },
    create: {
      slug: 'privacy',
      title: 'Privacy Policy',
      metaTitle: 'Privacy Policy | Spiritual California',
      metaDescription:
        'Privacy Policy for the Spiritual California marketplace platform.',
      eyebrow: 'Legal',
      subtitle: null,
      body: PRIVACY_BODY,
      isPublished: true,
      publishedAt: now,
    },
    update: {
      title: 'Privacy Policy',
      metaTitle: 'Privacy Policy | Spiritual California',
      metaDescription:
        'Privacy Policy for the Spiritual California marketplace platform.',
      eyebrow: 'Legal',
      body: PRIVACY_BODY,
      isPublished: true,
    },
  });
  console.log(`✓ Upserted static page: ${privacy.slug}`);

  const about = await prisma.staticPage.upsert({
    where: { slug: 'about' },
    create: {
      slug: 'about',
      title: 'Wellness deserves trust',
      metaTitle: 'About Us | Spiritual California',
      metaDescription:
        'Learn how Spiritual California is building a trusted, verified marketplace connecting seekers with authentic wellness practitioners.',
      eyebrow: 'Our Story',
      subtitle: null,
      body: ABOUT_BODY,
      isPublished: true,
      publishedAt: now,
    },
    update: {
      title: 'Wellness deserves trust',
      metaTitle: 'About Us | Spiritual California',
      metaDescription:
        'Learn how Spiritual California is building a trusted, verified marketplace connecting seekers with authentic wellness practitioners.',
      eyebrow: 'Our Story',
      body: ABOUT_BODY,
      isPublished: true,
    },
  });
  console.log(`✓ Upserted static page: ${about.slug}`);

  const mission = await prisma.staticPage.upsert({
    where: { slug: 'mission' },
    create: {
      slug: 'mission',
      title: 'A single trusted destination for mind, body & soul',
      metaTitle: 'Our Mission | Spiritual California',
      metaDescription:
        "Spiritual California's mission: building a single trusted destination for mind, body and soul — where verification, community, and transformation converge.",
      eyebrow: 'Our Mission',
      subtitle: null,
      body: MISSION_BODY,
      isPublished: true,
      publishedAt: now,
    },
    update: {
      title: 'A single trusted destination for mind, body & soul',
      metaTitle: 'Our Mission | Spiritual California',
      metaDescription:
        "Spiritual California's mission: building a single trusted destination for mind, body and soul — where verification, community, and transformation converge.",
      eyebrow: 'Our Mission',
      body: MISSION_BODY,
      isPublished: true,
    },
  });
  console.log(`✓ Upserted static page: ${mission.slug}`);

  const terms = await prisma.staticPage.upsert({
    where: { slug: 'terms' },
    create: {
      slug: 'terms',
      title: 'Terms of Service',
      metaTitle: 'Terms of Service | Spiritual California',
      metaDescription:
        'Terms of Service for the Spiritual California marketplace platform.',
      eyebrow: 'Legal',
      subtitle: null,
      body: TERMS_BODY,
      isPublished: true,
      publishedAt: now,
    },
    update: {
      title: 'Terms of Service',
      metaTitle: 'Terms of Service | Spiritual California',
      metaDescription:
        'Terms of Service for the Spiritual California marketplace platform.',
      eyebrow: 'Legal',
      body: TERMS_BODY,
      isPublished: true,
    },
  });
  console.log(`✓ Upserted static page: ${terms.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
