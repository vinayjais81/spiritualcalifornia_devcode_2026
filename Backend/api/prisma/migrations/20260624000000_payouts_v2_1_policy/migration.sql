-- Payouts v2.1 — Practitioner Payout Policy amendment (2026-06-24)
--
-- Client "Implement Practitioner Payout Policy":
--   * Flat 20% platform commission for 1:1 Sessions (SERVICE), Events, and Tours.
--   * Products (Conscious Shop) commission UNCHANGED at 10%.
--   * Tours folded into Events for clearance: departure end + 3 days (was 5).
--   * Products clear at delivery + 17 days (14-day return window + 3-day buffer; was 7).
--
-- See docs/guide-payouts-v2.1-amendment.md for the full delta + rationale.
-- The Stripe-fee-to-platform change, the no-delivery fallback (order + 21d),
-- the open-dispute clearance guard, the $100 minimum, and the auto-payout
-- sweep are code/config changes, not schema — see the amendment doc §6.

-- ─────────────────────────────────────────────
-- Commission: effective-date the old platform defaults, insert new 20% rows.
-- Effective-dating (rather than UPDATE-in-place) preserves the rate history
-- the CommissionRate audit design depends on.
-- ─────────────────────────────────────────────

UPDATE "commission_rates"
SET "effectiveUntil" = CURRENT_TIMESTAMP
WHERE "guideId" IS NULL
  AND "effectiveUntil" IS NULL
  AND "category" IN ('SERVICE', 'EVENT', 'TOUR');

INSERT INTO "commission_rates" ("id", "category", "guideId", "percent", "effectiveFrom") VALUES
  (gen_random_uuid()::text, 'SERVICE', NULL, 20.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EVENT',   NULL, 20.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TOUR',    NULL, 20.00, CURRENT_TIMESTAMP);
-- PRODUCT platform default left untouched at 10.00.

-- ─────────────────────────────────────────────
-- Clearance: Tours fold into Events (T+3); Products 7 → 17 days.
-- SERVICE / EVENT stay at 3.
-- ─────────────────────────────────────────────

UPDATE "clearance_rules" SET "days" = 3,  "updatedAt" = CURRENT_TIMESTAMP WHERE "category" = 'TOUR';
UPDATE "clearance_rules" SET "days" = 17, "updatedAt" = CURRENT_TIMESTAMP WHERE "category" = 'PRODUCT';
