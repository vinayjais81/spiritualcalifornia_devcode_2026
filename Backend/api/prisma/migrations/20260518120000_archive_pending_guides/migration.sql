-- ─── Archive Pending Guides ──────────────────────────────────────────────────
-- Admin "Remove" action for pending guide registrations. Adds soft-delete
-- fields on guide_profiles + users and a separate audit table that survives
-- the 90-day hard-delete cron.
-- See docs/admin-archive-pending-guides.md for the full design.

-- 1. Soft-delete columns on User (frees the original email at archive time
--    via rename; archivedAt itself is the marker).
ALTER TABLE "users"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

-- 2. Soft-delete columns on GuideProfile.
ALTER TABLE "guide_profiles"
  ADD COLUMN "archivedAt"     TIMESTAMP(3),
  ADD COLUMN "archivedBy"     TEXT,
  ADD COLUMN "archivedReason" TEXT;

CREATE INDEX "guide_profiles_archivedAt_idx" ON "guide_profiles"("archivedAt");

-- 3. Audit table.
CREATE TABLE "archived_guide_registrations" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT,
  "guideProfileId"   TEXT,
  "originalEmail"    TEXT NOT NULL,
  "displayName"      TEXT,
  "hadStripeAccount" BOOLEAN NOT NULL DEFAULT false,
  "stripeAccountId"  TEXT,
  "credentialS3Keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "avatarS3Key"      TEXT,
  "personaInquiryId" TEXT,
  "reason"           TEXT NOT NULL,
  "archivedBy"       TEXT NOT NULL,
  "archivedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hardDeletedAt"    TIMESTAMP(3),
  "hardDeleteNotes"  TEXT,
  CONSTRAINT "archived_guide_registrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "archived_guide_registrations_originalEmail_idx"
  ON "archived_guide_registrations"("originalEmail");
CREATE INDEX "archived_guide_registrations_archivedAt_idx"
  ON "archived_guide_registrations"("archivedAt");
CREATE INDEX "archived_guide_registrations_hardDeletedAt_idx"
  ON "archived_guide_registrations"("hardDeletedAt");
