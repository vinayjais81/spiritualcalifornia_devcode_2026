-- ─── Drop the anonymous wrapper <div> inside each .pillar card ─────────
--
-- The original mission seed (20260526140000_richer_mission_layout) used
-- an unnamed wrapper <div> between .pillar-icon and the title/text
-- because that's how the client's design source nested its HTML. The
-- Tiptap pillar node added in the same commit as this migration parses
-- .pillar's direct children strictly (icon + title + text), and the
-- public CSS was just refactored to use grid-template-areas so the
-- wrapper isn't needed for layout either.
--
-- This migration rewrites the mission body to drop those wrappers
-- (and the matching </div>), so:
--   • Public render still looks identical (CSS uses grid areas)
--   • Tiptap can round-trip the card without garbling structure
--
-- Idempotent: the body is overwritten in full, and the new mission seed
-- shape is the only canonical version going forward.

UPDATE "static_pages"
SET
  "body" = $body$
<p>At Spiritual California, our mission is to make the spiritual space <strong>safe, accessible, and profoundly clear</strong> for seekers at every stage of their journey.</p>

<p>We believe that true healing and growth happen when trust is established first. The spiritual wellness landscape is vast and beautiful — but it can also be confusing, unregulated, and difficult to navigate. Too many seekers have had experiences that left them feeling more lost than found. We built Spiritual California to change that.</p>

<blockquote>"We are not just building a directory. We are building a sanctuary — a space where every seeker can find their path to the source with confidence, clarity, and care."</blockquote>

<p>Every practitioner on our platform goes through a rigorous, multi-step vetting process. We verify credentials, check references, review their approach to ethics, and ensure they are committed to the wellbeing of those they serve. When you reach out for guidance through Spiritual California, you are connecting with someone who is not only gifted but deeply responsible in their practice.</p>

<div class="steps-box">
  <h3>How We Verify Our Practitioners</h3>
  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <p class="step-title">Application &amp; Background Review</p>
      <p class="step-text">Every practitioner submits a detailed application including training history, certifications, years of practice, and areas of specialization. We review each application individually — no automated approvals.</p>
    </div>
  </div>
  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <p class="step-title">Credential Verification</p>
      <p class="step-text">We contact certifying bodies, training schools, and professional associations directly to confirm the validity of credentials. Verified practitioners receive a ✦ badge on their profile.</p>
    </div>
  </div>
  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <p class="step-title">Ethics &amp; Approach Interview</p>
      <p class="step-text">We conduct a personal conversation with each practitioner about their ethical framework, how they handle boundaries, and how they approach vulnerable clients. This is non-negotiable.</p>
    </div>
  </div>
  <div class="step">
    <div class="step-num">4</div>
    <div class="step-body">
      <p class="step-title">Community References</p>
      <p class="step-text">We collect and review references from previous clients and colleagues. Ongoing community feedback through our review system ensures continued accountability.</p>
    </div>
  </div>
  <div class="step">
    <div class="step-num">5</div>
    <div class="step-body">
      <p class="step-title">Ongoing Monitoring</p>
      <p class="step-text">Verification is not a one-time event. We monitor practitioner reviews, respond to community concerns, and conduct periodic re-verification to ensure standards are maintained.</p>
    </div>
  </div>
</div>

<p>Our four core commitments to every seeker:</p>

<div class="pillar">
  <div class="pillar-icon">🛡️</div>
  <div class="pillar-title">Safety First</div>
  <p class="pillar-text">Every practitioner is vetted. Every interaction is supported by clear community guidelines. You are never alone in navigating your experience.</p>
</div>

<div class="pillar">
  <div class="pillar-icon">🌿</div>
  <div class="pillar-title">Radical Accessibility</div>
  <p class="pillar-text">Spiritual wellness should not be a luxury. We work to ensure our platform serves seekers across all backgrounds, offering online sessions, sliding-scale practitioners, and free educational content.</p>
</div>

<div class="pillar">
  <div class="pillar-icon">☀️</div>
  <div class="pillar-title">Absolute Clarity</div>
  <p class="pillar-text">No mystification, no gatekeeping. We translate complex traditions into clear, honest language so you can make informed decisions about your healing journey.</p>
</div>

<div class="pillar">
  <div class="pillar-icon">🤝</div>
  <div class="pillar-title">Deep Connection</div>
  <p class="pillar-text">We believe the most profound healing happens in relationship. Our platform is designed to foster genuine, lasting connections between seekers and guides — not transactions.</p>
</div>

<p>We operate on the principle of <strong>conscious capitalism</strong>. We view money as oxygen for the body — necessary to live, but not the sole reason for living. This philosophy drives every decision we make: how we price our services, how we compensate our guides, and how we invest in the communities we serve.</p>

<p>Whether you are looking for a meditation guide, an Ayurvedic doctor, a sound healer, or a sacred travel experience — we are here to be the bridge that connects you to the right support for your body, mind, and soul.</p>

<p>Welcome to Spiritual California. We are so glad you found us.</p>
  $body$,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'mission';
