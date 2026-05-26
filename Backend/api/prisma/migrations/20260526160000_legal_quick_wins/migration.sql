-- ─── Legal quick-wins (compliance spec PR1) ────────────────────────────
--
-- Two surgical changes triggered by the 2026-05-22 compliance spec:
--
--   1) `/travel-disclosures` was renamed to `/disclosures` (spec Task 1).
--      Body links inside the terms / privacy / refund-policy rows are
--      updated to point at the new canonical URL. The legacy route is
--      kept as a permanent 301 redirect in next.config.ts, so this is
--      cosmetic (and SEO-friendly) rather than load-bearing.
--
--   2) Privacy §7 needs `id="dnsmpi"` so the footer's
--      "Do Not Sell or Share My Personal Information" link
--      (`/privacy#dnsmpi`) deep-scrolls to the right section
--      (spec Task 2). The id is added to the existing <h2> by REPLACE.
--
-- All updates use REPLACE() so the migration is idempotent — if a
-- substring isn't present (because an admin already edited it), the
-- UPDATE is a no-op for that row.

-- Body link rewrites: /travel-disclosures → /disclosures
UPDATE "static_pages"
SET
  "body"      = REPLACE("body", 'href="/travel-disclosures"', 'href="/disclosures"'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" IN ('terms', 'privacy', 'refund-policy')
  AND "body" LIKE '%href="/travel-disclosures"%';

-- DNSMPI anchor: add id="dnsmpi" to the §7 heading on Privacy.
UPDATE "static_pages"
SET
  "body"      = REPLACE(
    "body",
    '<h2>§ 7 — We do not sell or share your personal information</h2>',
    '<h2 id="dnsmpi">§ 7 — We do not sell or share your personal information</h2>'
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'privacy'
  AND "body" LIKE '%<h2>§ 7 — We do not sell or share your personal information</h2>%';
