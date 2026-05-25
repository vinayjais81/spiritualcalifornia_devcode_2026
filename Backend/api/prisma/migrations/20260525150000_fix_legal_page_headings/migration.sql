-- ─── Restore em-dashes in two legal-page section headings ──────────────
--
-- Proofreading against the client-provided PDFs (docs/Cancellation &
-- Refund Policy ... _ Claude.pdf and docs/Privacy Policy ... _ Claude.pdf,
-- 2026-05-22) caught two spots in the prior seed migrations where the
-- intended em-dash separator was rendered as a colon:
--   • refund-policy §3:  "If you cancel: traveler cancellation tiers"
--                      → "If you cancel — traveler cancellation tiers"
--   • privacy       §2:  "Notice at collection: our booking and intake forms"
--                      → "Notice at collection — our booking and intake forms"
--
-- Surgical UPDATE via REPLACE() rather than re-pasting the full 12KB
-- bodies. Idempotent: if the substring isn't present (because an admin
-- already fixed it via /admin/static-pages, or because this migration
-- has run before), REPLACE is a no-op and the row is unchanged.

UPDATE "static_pages"
SET
  "body"      = REPLACE(
    "body",
    '§ 3 — If you cancel: traveler cancellation tiers',
    '§ 3 — If you cancel — traveler cancellation tiers'
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'refund-policy'
  AND "body" LIKE '%§ 3 — If you cancel: traveler cancellation tiers%';

UPDATE "static_pages"
SET
  "body"      = REPLACE(
    "body",
    '§ 2 — Notice at collection: our booking and intake forms',
    '§ 2 — Notice at collection — our booking and intake forms'
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'privacy'
  AND "body" LIKE '%§ 2 — Notice at collection: our booking and intake forms%';
