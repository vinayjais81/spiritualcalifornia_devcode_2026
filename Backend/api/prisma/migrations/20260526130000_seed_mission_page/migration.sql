-- ─── Seed / update the Mission page StaticPage row ─────────────────────
--
-- Installs the client-finalized "Our Mission" copy as the source of
-- truth for /mission. The mission slug has had a stub row in every
-- environment since the original CMS bootstrap (2026-04-23), so this
-- uses Pattern B (INSERT ... ON CONFLICT DO UPDATE) — same as the
-- about / privacy / terms seeds.
--
-- Content source:
--   design/Spiritual_California_Website_Final_v2/spiritual_california_branded/mission.html
-- shared by the client on 2026-05-26. The design page uses two custom
-- CSS layouts (`.steps-box` for the 5-step verification flow and
-- `.pillar` cards for the four commitments) that aren't part of the
-- shared StaticPageRenderer. We translate them to renderer-supported
-- tags:
--   • Steps → <h3> heading + <ol> with bold lead-ins
--   • Pillars → <h3> headings with the source emoji inline + <p>
-- so the body renders cleanly against the marketing layout's typography
-- without needing renderer changes. Visual hierarchy preserved.
--
-- Future admin edits via /admin/static-pages stay safe (Prisma migrations
-- only run once per environment).

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
  'mission',
  'Our Mission',
  'Our Mission — Spiritual California',
  'Making the spiritual space safe, accessible, and profoundly clear — how we verify every practitioner, and the four commitments behind everything we do.',
  'Our Core',
  NULL,
  $body$
<p>At Spiritual California, our mission is to make the spiritual space <strong>safe, accessible, and profoundly clear</strong> for seekers at every stage of their journey.</p>

<p>We believe that true healing and growth happen when trust is established first. The spiritual wellness landscape is vast and beautiful — but it can also be confusing, unregulated, and difficult to navigate. Too many seekers have had experiences that left them feeling more lost than found. We built Spiritual California to change that.</p>

<blockquote>"We are not just building a directory. We are building a sanctuary — a space where every seeker can find their path to the source with confidence, clarity, and care."</blockquote>

<p>Every practitioner on our platform goes through a rigorous, multi-step vetting process. We verify credentials, check references, review their approach to ethics, and ensure they are committed to the wellbeing of those they serve. When you reach out for guidance through Spiritual California, you are connecting with someone who is not only gifted but deeply responsible in their practice.</p>

<h3>How We Verify Our Practitioners</h3>
<ol>
  <li><strong>Application &amp; Background Review.</strong> Every practitioner submits a detailed application including training history, certifications, years of practice, and areas of specialization. We review each application individually — no automated approvals.</li>
  <li><strong>Credential Verification.</strong> We contact certifying bodies, training schools, and professional associations directly to confirm the validity of credentials. Verified practitioners receive a ✦ badge on their profile.</li>
  <li><strong>Ethics &amp; Approach Interview.</strong> We conduct a personal conversation with each practitioner about their ethical framework, how they handle boundaries, and how they approach vulnerable clients. This is non-negotiable.</li>
  <li><strong>Community References.</strong> We collect and review references from previous clients and colleagues. Ongoing community feedback through our review system ensures continued accountability.</li>
  <li><strong>Ongoing Monitoring.</strong> Verification is not a one-time event. We monitor practitioner reviews, respond to community concerns, and conduct periodic re-verification to ensure standards are maintained.</li>
</ol>

<p>Our four core commitments to every seeker:</p>

<h3>🛡️ Safety First</h3>
<p>Every practitioner is vetted. Every interaction is supported by clear community guidelines. You are never alone in navigating your experience.</p>

<h3>🌿 Radical Accessibility</h3>
<p>Spiritual wellness should not be a luxury. We work to ensure our platform serves seekers across all backgrounds, offering online sessions, sliding-scale practitioners, and free educational content.</p>

<h3>☀️ Absolute Clarity</h3>
<p>No mystification, no gatekeeping. We translate complex traditions into clear, honest language so you can make informed decisions about your healing journey.</p>

<h3>🤝 Deep Connection</h3>
<p>We believe the most profound healing happens in relationship. Our platform is designed to foster genuine, lasting connections between seekers and guides — not transactions.</p>

<p>We operate on the principle of <strong>conscious capitalism</strong>. We view money as oxygen for the body — necessary to live, but not the sole reason for living. This philosophy drives every decision we make: how we price our services, how we compensate our guides, and how we invest in the communities we serve.</p>

<p>Whether you are looking for a meditation guide, an Ayurvedic doctor, a sound healer, or a sacred travel experience — we are here to be the bridge that connects you to the right support for your body, mind, and soul.</p>

<p>Welcome to Spiritual California. We are so glad you found us.</p>
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
