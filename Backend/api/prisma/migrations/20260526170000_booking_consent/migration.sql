-- ─── Booking Consent (compliance clickwrap record) ─────────────────────
--
-- Persists the consent capture required by the compliance implementation
-- spec (2026-05-22, Task 4e). One row per tour booking, written between
-- the booking creation and the Stripe payment-intent mint.
-- PaymentsService.createPaymentIntent will refuse to mint an intent for
-- a TourBooking that has no consent row — that gate is what makes the
-- liability / cancellation / arbitration terms enforceable.
--
-- onDelete CASCADE: cancelling/deleting a booking takes its consent with
-- it (no orphan rows). Booking deletion is itself rare and is admin-only.

CREATE TABLE "booking_consents" (
  "id"            TEXT PRIMARY KEY,
  "tourBookingId" TEXT NOT NULL,
  "acceptedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip"            TEXT NOT NULL,
  "consentText"   TEXT NOT NULL,
  "docVersions"   JSONB NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "booking_consents_tourBookingId_fkey"
    FOREIGN KEY ("tourBookingId") REFERENCES "tour_bookings"("id") ON DELETE CASCADE
);

-- Unique: one consent row per booking. The application code upserts on
-- retry, but the DB constraint is the last line of defense against
-- duplicates.
CREATE UNIQUE INDEX "booking_consents_tourBookingId_key"
  ON "booking_consents"("tourBookingId");

CREATE INDEX "booking_consents_acceptedAt_idx"
  ON "booking_consents"("acceptedAt");
