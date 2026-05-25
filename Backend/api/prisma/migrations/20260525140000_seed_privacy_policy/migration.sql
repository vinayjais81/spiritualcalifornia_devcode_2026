-- ─── Seed / update the Privacy Policy StaticPage row ────────────────────
--
-- /privacy already has a dedicated route + slug ("privacy") that
-- pre-dates this migration. A stub row exists in most environments from
-- the initial CMS bootstrap. This migration installs the client-
-- finalized policy text (2026-05-22) as the source of truth.
--
-- ON CONFLICT (slug) DO UPDATE (not DO NOTHING) — chosen deliberately
-- so the new client copy lands on every environment whether or not a
-- stub already exists. If you've made manual /admin/static-pages edits
-- to the privacy row you want to preserve, capture them BEFORE this
-- migration deploys; afterwards, future admin edits stay safe because
-- Prisma migrations only run once per environment.
--
-- Body is HTML targeting StaticPageRenderer's `.static-page-body`
-- styles (h2 / h3 / p / ul / ol / li / strong / em / a / blockquote /
-- table / hr). Table styles added alongside this migration so §3's
-- category breakdown renders cleanly.

INSERT INTO "static_pages" (
  "id",
  "slug",
  "title",
  "metaTitle",
  "metaDescription",
  "eyebrow",
  "subtitle",
  "body",
  "isPublished",
  "publishedAt",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  'privacy',
  'Privacy Policy',
  'Privacy Policy | Spiritual California',
  'How Spiritual California collects, uses, and discloses personal information — written for California residents under the CCPA/CPRA.',
  'Legal · Privacy',
  'Written for California residents under the CCPA/CPRA.',
  $body$
<p>This Privacy Policy explains how Spiritual California Inc. collects, uses, and discloses personal information, and the choices you have. It is written for California residents under the California Consumer Privacy Act, as amended (the "CCPA").</p>

<h2>§ 1 — Who we are</h2>
<p>Spiritual California Inc. ("Spiritual California," "we," "us") is the business responsible for the personal information described here. We operate an online marketplace connecting people ("Seekers") with independent providers of spiritual, wellness, and cultural experiences, including tour operators, practitioners, event hosts, and sellers. Our contact details are at the end of this policy.</p>

<h2>§ 2 — Notice at collection: our booking and intake forms</h2>
<p><strong>Why we ask for this.</strong> When you book a journey, session, event, or product, we collect the information needed to confirm and deliver it — your name, contact details, date of birth, nationality, payment information, and, for travel, any health or accessibility information you choose to share so the experience can be delivered safely.</p>
<p><strong>How we use it.</strong> Booking details are used to process your purchase, to share what is necessary with the independent provider delivering your experience (for example, a local tour operator), and to contact you about it. Health information is used only to keep you safe during the experience and is not used for marketing, profiling, or any other purpose.</p>
<p><strong>How long we keep it.</strong> We retain booking and transaction records as required by law; we delete health information within 90 days after the experience ends. The categories, purposes, and your rights are described in full below.</p>

<h2>§ 3 — Personal information we collect</h2>
<p>In the past 12 months we have collected the following categories of personal information, depending on how you use our services:</p>
<table>
  <thead>
    <tr>
      <th>Category (CCPA)</th>
      <th>Examples</th>
      <th>Why we collect it</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Identifiers</strong></td>
      <td>Name, email, phone, postal address, account ID, IP address</td>
      <td>Account creation, bookings, communication, security</td>
    </tr>
    <tr>
      <td><strong>Customer records</strong></td>
      <td>Payment information (processed by our payment provider), billing details, booking history</td>
      <td>Process payments and deliver purchases</td>
    </tr>
    <tr>
      <td><strong>Characteristics</strong></td>
      <td>Date of birth, nationality, age confirmation</td>
      <td>Verify eligibility (18+); nationality for travel-document and operator-manifest purposes</td>
    </tr>
    <tr>
      <td><strong>Commercial information</strong></td>
      <td>Journeys, sessions, events, and products purchased or considered</td>
      <td>Fulfill orders and improve our offerings</td>
    </tr>
    <tr>
      <td><strong>Internet/network activity</strong></td>
      <td>Pages viewed, general device and usage data</td>
      <td>Operate, secure, and improve the site</td>
    </tr>
    <tr>
      <td><strong>Sensory information</strong></td>
      <td>Reviews, photos, and messages you submit</td>
      <td>Display reviews and respond to you</td>
    </tr>
    <tr>
      <td><strong>Professional information (providers)</strong></td>
      <td>For practitioners/operators/hosts: credentials, licenses, business details</td>
      <td>Verification and marketplace listings</td>
    </tr>
    <tr>
      <td><strong>Sensitive personal information</strong></td>
      <td>Health/accessibility information you share for trip safety; passport or government-ID details if required for an international journey</td>
      <td>Deliver the experience safely; meet travel/entry requirements — see §4</td>
    </tr>
  </tbody>
</table>
<p><strong>Sources.</strong> We collect this directly from you, automatically from your use of the site, and occasionally from providers (for example, a practitioner confirming a completed session).</p>

<h2>§ 4 — Sensitive personal information</h2>
<p>Some information we collect is "sensitive personal information" under the CCPA — most notably the health or accessibility information you may share for a journey, and any passport or government-identification details required for international travel. We use sensitive personal information only for the limited purposes of providing the experience you request and keeping you safe — for example, sharing relevant health context with the trip leader or on-site contact, or providing passport details to the operator or government agency that requires them. We do not use or disclose sensitive personal information to infer characteristics about you, for marketing, or for any purpose beyond delivering your experience. Because our use is limited to these permitted purposes, the CCPA "right to limit the use of sensitive personal information" does not apply; you may still ask us to delete this information at any time.</p>

<h2>§ 5 — How we use personal information</h2>
<ul>
  <li>To create and manage your account and process your bookings and purchases;</li>
  <li>To arrange and deliver experiences with the independent providers you book;</li>
  <li>To communicate with you about your bookings, respond to requests, and provide support;</li>
  <li>To process payments through our payment provider;</li>
  <li>To operate, secure, maintain, and improve our services;</li>
  <li>To send you service messages and, where you have not opted out, occasional updates about offerings; and</li>
  <li>To comply with law, including our recordkeeping obligations as a Seller of Travel, and to protect our rights.</li>
</ul>

<h2>§ 6 — How we disclose personal information</h2>
<p>We disclose personal information to the following categories of recipients, only as needed for the purposes above:</p>
<ul>
  <li><strong>Independent providers</strong> who deliver your experience — for example, the local tour operator running your journey — receive the information necessary to provide it (such as traveler names, contact details, and any health or document information required for that journey). Providers are contractually required to use it only to deliver the experience and to protect it.</li>
  <li><strong>Service providers</strong> who process information on our behalf under contract, including: Stripe (payment processing), Calendly (session scheduling), Supabase (database and backend hosting), Lovable (application platform/hosting), our email and analytics providers, and similar vendors. They are permitted to use the information only to perform services for us.</li>
  <li><strong>Legal and safety recipients</strong> — authorities or advisors where required by law, to enforce our terms, or to protect the rights, safety, or property of any person.</li>
  <li><strong>Business transfers</strong> — a successor in connection with a merger, acquisition, or sale of assets.</li>
</ul>

<h2>§ 7 — We do not sell or share your personal information</h2>
<p><strong>Do Not Sell or Share My Personal Information.</strong></p>
<p>Spiritual California does not sell your personal information and does not share it for cross-context behavioral advertising, as those terms are defined under the CCPA. Because we do not sell or share, there is nothing for you to opt out of — but if you have any question about this, or wish to confirm your preferences, contact us at <a href="mailto:privacy@spiritualcalifornia.com">privacy@spiritualcalifornia.com</a> and we will respond. We also honor browser Global Privacy Control (GPC) signals where applicable.</p>

<h2>§ 8 — Cookies &amp; analytics</h2>
<p>We use cookies and similar technologies that are necessary to operate the site (for example, to keep you signed in and to secure the site) and privacy-preserving analytics to understand general usage. We do not use advertising or cross-site tracking cookies. You can control cookies through your browser settings; disabling necessary cookies may affect how the site works.</p>

<h2>§ 9 — How long we keep information</h2>
<p>We keep personal information only as long as needed for the purposes above, then delete or de-identify it. In general: account information for as long as your account is active; booking and transaction records as required by law (including Seller of Travel and tax recordkeeping); and health information shared for a journey for no longer than 90 days after the journey ends, unless a longer period is required to resolve a claim.</p>

<h2>§ 10 — Your California privacy rights</h2>
<p>If you are a California resident, you have the right to:</p>
<ul>
  <li><strong>Know / Access</strong> — request the categories and specific pieces of personal information we have collected, the sources, the purposes, and the categories of recipients;</li>
  <li><strong>Delete</strong> — request deletion of personal information we collected from you, subject to legal exceptions;</li>
  <li><strong>Correct</strong> — request correction of inaccurate personal information;</li>
  <li><strong>Opt out of sale/sharing</strong> — although we do not sell or share personal information (see §7); and</li>
  <li><strong>Non-discrimination</strong> — we will not discriminate against you for exercising any of these rights.</li>
</ul>

<h2>§ 11 — How to exercise your rights</h2>
<p>To make a request, email us at <a href="mailto:privacy@spiritualcalifornia.com">privacy@spiritualcalifornia.com</a> with the subject line "Privacy Request" and tell us which right you wish to exercise. We will:</p>
<ul>
  <li><strong>Verify your request</strong> by confirming details we already hold (for example, your account email and recent booking) to protect your information;</li>
  <li><strong>Honor authorized agents</strong> who submit a request on your behalf with your written permission;</li>
  <li><strong>Respond within 45 days</strong>, extendable once by another 45 days where reasonably necessary, and tell you if we need more time; and</li>
  <li><strong>Process your request free of charge</strong>, except where permitted by law for excessive or repetitive requests.</li>
</ul>

<h2>§ 12 — Children</h2>
<p>Our services are intended for adults 18 and older. We do not knowingly collect personal information from anyone under 18. If you believe a minor has provided us information, contact us and we will delete it.</p>

<h2>§ 13 — If you are outside California</h2>
<p>This policy is written for California residents. If you reside outside the United States — including in the European Union, the United Kingdom, or India — please contact us before using our services so we can apply the appropriate data-protection framework to your information. We will handle your information consistently with applicable law.</p>

<h2>§ 14 — Data security</h2>
<p>We maintain reasonable administrative, technical, and physical safeguards designed to protect personal information. No system is perfectly secure, but we work to protect your information and require our service providers and the providers who deliver your experiences to do the same.</p>

<h2>§ 15 — Providers on our platform</h2>
<p>If you are a practitioner, tour operator, event host, or other provider, we also collect information you give us to verify and list you and to operate the marketplace. We use it for those purposes and disclose it to Seekers and service providers as needed to run the platform. Your separate provider agreement with us governs your relationship with us; this policy describes how we handle your personal information.</p>

<h2>§ 16 — Changes to this policy</h2>
<p>We may update this policy from time to time. We will revise the "last updated" date above and, for material changes, provide additional notice where appropriate. Your continued use after the changes take effect means you accept the updated policy.</p>

<h2>§ 17 — Contact us</h2>
<p><strong>Spiritual California Inc.</strong><br/>
631 E El Camino Real, Sunnyvale, CA 94087<br/>
Email: <a href="mailto:privacy@spiritualcalifornia.com">privacy@spiritualcalifornia.com</a> &nbsp;·&nbsp; Phone: (408) 780-4722<br/>
California Seller of Travel CST #2171340-40</p>

<hr/>

<p><small>© 2026 Spiritual California Inc. · This Privacy Policy should be read together with our Terms of Service, Cancellation &amp; Refund Policy, and Travel Disclosures.</small></p>
  $body$,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "title"           = EXCLUDED."title",
  "metaTitle"       = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "eyebrow"         = EXCLUDED."eyebrow",
  "subtitle"        = EXCLUDED."subtitle",
  "body"            = EXCLUDED."body",
  "isPublished"     = EXCLUDED."isPublished",
  "updatedAt"       = CURRENT_TIMESTAMP;
