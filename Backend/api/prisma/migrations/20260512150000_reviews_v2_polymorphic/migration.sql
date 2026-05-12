-- Reviews v2: make the Review model polymorphic across SERVICE / EVENT / TOUR / PRODUCT.
-- Existing rows always reviewed a service-booking, so the backfill assigns them
-- targetType=SERVICE and copies bookings.serviceId into targetEntityId.

-- 1. New enum
CREATE TYPE "ReviewTarget" AS ENUM ('SERVICE', 'EVENT', 'TOUR', 'PRODUCT');

-- 2. Drop old FK and index that pointed at targetId
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_targetId_fkey";
DROP INDEX IF EXISTS "reviews_targetId_isApproved_idx";

-- 3. Rename targetId → guideId (always a guide User.id, kept for cross-offering roll-up)
ALTER TABLE "reviews" RENAME COLUMN "targetId" TO "guideId";

-- 4. Add new polymorphic columns (NULLable up-front so backfill can fill them)
ALTER TABLE "reviews"
  ADD COLUMN "targetType" "ReviewTarget",
  ADD COLUMN "targetEntityId" TEXT,
  ADD COLUMN "ticketPurchaseId" TEXT,
  ADD COLUMN "tourBookingId" TEXT,
  ADD COLUMN "orderItemId" TEXT,
  ADD COLUMN "guideReply" TEXT,
  ADD COLUMN "guideRepliedAt" TIMESTAMP(3);

-- 5. Backfill: every existing row is a service review, copy the service id from its booking
UPDATE "reviews" r
SET "targetType" = 'SERVICE',
    "targetEntityId" = b."serviceId"
FROM "bookings" b
WHERE r."bookingId" = b."id"
  AND r."targetEntityId" IS NULL;

-- 6. Enforce NOT NULL on the new identity columns once backfill is done
ALTER TABLE "reviews" ALTER COLUMN "targetType" SET NOT NULL;
ALTER TABLE "reviews" ALTER COLUMN "targetEntityId" SET NOT NULL;

-- 7. bookingId is no longer mandatory (a row is keyed by exactly one of the four source FKs)
ALTER TABLE "reviews" ALTER COLUMN "bookingId" DROP NOT NULL;

-- 8. Re-add FKs: guideId → users, new per-source FKs (all SET NULL on parent delete to keep history intact)
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_guideId_fkey"
    FOREIGN KEY ("guideId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_ticketPurchaseId_fkey"
    FOREIGN KEY ("ticketPurchaseId") REFERENCES "ticket_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_tourBookingId_fkey"
    FOREIGN KEY ("tourBookingId") REFERENCES "tour_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. Unique indexes per source FK so a single transaction can only be reviewed once
CREATE UNIQUE INDEX "reviews_ticketPurchaseId_key" ON "reviews"("ticketPurchaseId");
CREATE UNIQUE INDEX "reviews_tourBookingId_key"    ON "reviews"("tourBookingId");
CREATE UNIQUE INDEX "reviews_orderItemId_key"      ON "reviews"("orderItemId");

-- 10. Replacement non-unique indexes for the two read paths the service uses
CREATE INDEX "reviews_guideId_isApproved_idx" ON "reviews"("guideId", "isApproved");
CREATE INDEX "reviews_targetType_targetEntityId_isApproved_idx"
  ON "reviews"("targetType", "targetEntityId", "isApproved");

-- 11. Per-entity rating aggregates (denormalized for fast listing-page reads)
ALTER TABLE "services"    ADD COLUMN "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
                          ADD COLUMN "reviewCount"   INTEGER          NOT NULL DEFAULT 0;
ALTER TABLE "events"      ADD COLUMN "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
                          ADD COLUMN "reviewCount"   INTEGER          NOT NULL DEFAULT 0;
ALTER TABLE "soul_tours"  ADD COLUMN "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
                          ADD COLUMN "reviewCount"   INTEGER          NOT NULL DEFAULT 0;
ALTER TABLE "products"    ADD COLUMN "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
                          ADD COLUMN "reviewCount"   INTEGER          NOT NULL DEFAULT 0;

-- 12. Backfill the Service-level aggregates from the existing reviews
UPDATE "services" s
SET "averageRating" = COALESCE(agg.avg_rating, 0),
    "reviewCount"   = COALESCE(agg.cnt, 0)
FROM (
  SELECT "targetEntityId", AVG("rating")::float AS avg_rating, COUNT(*)::int AS cnt
  FROM "reviews"
  WHERE "targetType" = 'SERVICE' AND "isApproved" = TRUE AND "isFlagged" = FALSE
  GROUP BY "targetEntityId"
) agg
WHERE s."id" = agg."targetEntityId";
