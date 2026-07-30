-- Order stock holds (2026-07-30)
--
-- POST /orders decrements stock and increments promo usedCount inside its
-- create transaction so concurrent checkouts can't oversell. Nothing ever
-- released that reservation, so abandoning checkout at the payment step left a
-- PENDING order holding inventory and a promo redemption permanently, with no
-- way for the seeker to cancel it.
--
-- These columns give a PENDING order a hold window (reaped by the order-tasks
-- reaper), plus the same cancellation audit fields TourBooking already carries.
-- See docs/order-hold-expiry.md.

ALTER TABLE "orders" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "cancellationReason" TEXT;

CREATE INDEX "orders_status_holdExpiresAt_idx" ON "orders"("status", "holdExpiresAt");

-- Backfill: existing PENDING orders predate the hold window and are all
-- abandoned by definition (no payment ever completed on them). Give them an
-- already-elapsed hold so the reaper's first run releases their stock and
-- promo redemptions instead of leaving the historical junk in place.
UPDATE "orders" SET "holdExpiresAt" = "createdAt" WHERE "status" = 'PENDING';
