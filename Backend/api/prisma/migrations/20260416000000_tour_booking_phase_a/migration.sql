-- ─────────────────────────────────────────────
-- New Enums (idempotent)
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "DepartureStatus" AS ENUM ('SCHEDULED', 'FULL', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- Tour Departures (bookable instances of a tour)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tour_departures" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "spotsRemaining" INTEGER NOT NULL,
    "status" "DepartureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "priceOverride" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_departures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tour_departures_tourId_startDate_idx" ON "tour_departures"("tourId", "startDate");
CREATE INDEX IF NOT EXISTS "tour_departures_status_startDate_idx" ON "tour_departures"("status", "startDate");

DO $$ BEGIN
  ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_tourId_fkey"
      FOREIGN KEY ("tourId") REFERENCES "soul_tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- Tour Itinerary Days (day-by-day schedule)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tour_itinerary_days" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "meals" TEXT[],
    "accommodation" TEXT,
    "activities" TEXT[],
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_itinerary_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tour_itinerary_days_tourId_dayNumber_key" ON "tour_itinerary_days"("tourId", "dayNumber");

DO $$ BEGIN
  ALTER TABLE "tour_itinerary_days" ADD CONSTRAINT "tour_itinerary_days_tourId_fkey"
      FOREIGN KEY ("tourId") REFERENCES "soul_tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- Tour Booking Travelers (per-person manifest)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tour_booking_travelers" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "nationality" TEXT NOT NULL,
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_booking_travelers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tour_booking_travelers_bookingId_idx" ON "tour_booking_travelers"("bookingId");

DO $$ BEGIN
  ALTER TABLE "tour_booking_travelers" ADD CONSTRAINT "tour_booking_travelers_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "tour_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- Alter soul_tours — Phase A additions
-- ─────────────────────────────────────────────

ALTER TABLE "soul_tours" ADD COLUMN IF NOT EXISTS "difficultyLevel" TEXT;
ALTER TABLE "soul_tours" ADD COLUMN IF NOT EXISTS "languages" TEXT[] DEFAULT '{}';
ALTER TABLE "soul_tours" ADD COLUMN IF NOT EXISTS "meetingPoint" TEXT;
ALTER TABLE "soul_tours" ADD COLUMN IF NOT EXISTS "cancellationPolicy" JSONB;
ALTER TABLE "soul_tours" ADD COLUMN IF NOT EXISTS "balanceDueDaysBefore" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "soul_tours" ADD COLUMN IF NOT EXISTS "minDepositPerPerson" DECIMAL(10,2);

-- ─────────────────────────────────────────────
-- Alter tour_bookings — Phase A columns
-- ─────────────────────────────────────────────

ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "departureId" TEXT;
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "chosenDepositAmount" DECIMAL(10,2);
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "balanceDueAt" TIMESTAMP(3);
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "balanceReminderSentAt" TIMESTAMP(3);
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "holdExpiresAt" TIMESTAMP(3);
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "bookingReference" TEXT;
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "dietaryRequirements" TEXT;
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "dietaryNotes" TEXT;
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "healthConditions" TEXT;
ALTER TABLE "tour_bookings" ADD COLUMN IF NOT EXISTS "intentions" TEXT;

-- Indexes & constraints for tour_bookings
CREATE UNIQUE INDEX IF NOT EXISTS "tour_bookings_bookingReference_key" ON "tour_bookings"("bookingReference");
CREATE INDEX IF NOT EXISTS "tour_bookings_departureId_idx" ON "tour_bookings"("departureId");
CREATE INDEX IF NOT EXISTS "tour_bookings_status_holdExpiresAt_idx" ON "tour_bookings"("status", "holdExpiresAt");
CREATE INDEX IF NOT EXISTS "tour_bookings_status_balanceDueAt_idx" ON "tour_bookings"("status", "balanceDueAt");

DO $$ BEGIN
  ALTER TABLE "tour_bookings" ADD CONSTRAINT "tour_bookings_departureId_fkey"
      FOREIGN KEY ("departureId") REFERENCES "tour_departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- Alter ticket_purchases — event checkout additions
-- ─────────────────────────────────────────────

ALTER TABLE "ticket_purchases" ADD COLUMN IF NOT EXISTS "bookingFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE "ticket_purchases" ADD COLUMN "status" "TicketStatus" NOT NULL DEFAULT 'PENDING';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- purchaseGroupId: add nullable first, backfill, then set NOT NULL
ALTER TABLE "ticket_purchases" ADD COLUMN IF NOT EXISTS "purchaseGroupId" TEXT;
UPDATE "ticket_purchases" SET "purchaseGroupId" = "id" WHERE "purchaseGroupId" IS NULL;
ALTER TABLE "ticket_purchases" ALTER COLUMN "purchaseGroupId" SET NOT NULL;

-- Drop old unique index on qrCode (if exists) and add new indexes
DROP INDEX IF EXISTS "ticket_purchases_qrCode_key";
CREATE INDEX IF NOT EXISTS "ticket_purchases_purchaseGroupId_idx" ON "ticket_purchases"("purchaseGroupId");
CREATE INDEX IF NOT EXISTS "ticket_purchases_seekerId_idx" ON "ticket_purchases"("seekerId");
