-- ─── Add "What 'Verified' means" section to /about ─────────────────────
--
-- Compliance implementation spec (2026-05-22, Task 7): the "✦ Verified"
-- practitioner badge needs a clear explanation of what we actually
-- check, on /about, anchored by id="verified-meaning" so the badge
-- tooltip can deep-link to it.
--
-- The section is appended right after the closing welcome paragraph
-- ("Welcome to Spiritual California. We are so glad you are here.")
-- so it sits at the end of the page body. Verbatim text describes the
-- four checks performed by the verification pipeline:
--   1. Identity check (Persona / KYC)
--   2. Credential review (issuing-body verification)
--   3. Ethics interview (manual conversation)
--   4. Ongoing review (community feedback + periodic re-verification)
--
-- Surgical APPEND via REPLACE() — adds the new section after the
-- existing welcome paragraph WITHOUT touching anything else in the
-- about body. Idempotent: re-running is a no-op if the marker
-- substring already contains the new section.

UPDATE "static_pages"
SET
  "body"      = REPLACE(
    "body",
    '<p>Welcome to Spiritual California. We are so glad you are here.</p>',
    $append$<p>Welcome to Spiritual California. We are so glad you are here.</p>

<hr/>

<h2 id="verified-meaning">What "Verified" means</h2>
<p>When you see the <strong>✦ Verified</strong> badge on a practitioner's profile, it means that practitioner has been through every step of our review pipeline before being allowed to take bookings:</p>
<ul>
  <li><strong>Identity confirmed.</strong> Government-issued ID checked through a regulated identity-verification provider (we don't keep the document itself — only the verification result).</li>
  <li><strong>Credentials checked.</strong> Each certification or license they list is verified directly with the issuing body, training school, or professional association.</li>
  <li><strong>Ethics interview.</strong> A real conversation with our team about their ethical framework, how they hold boundaries, and how they work with vulnerable clients. Non-negotiable.</li>
  <li><strong>Ongoing review.</strong> The badge is not a one-time stamp — we monitor reviews, respond to community concerns, and conduct periodic re-verification so the badge keeps reflecting current standing.</li>
</ul>
<p>The badge says we've done the homework so you don't have to. It does not guarantee any particular outcome — practitioners are independent professionals, and your experience with any one of them is between you and them.</p>$append$
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'about'
  AND "body" LIKE '%<p>Welcome to Spiritual California. We are so glad you are here.</p>%'
  AND "body" NOT LIKE '%id="verified-meaning"%';
