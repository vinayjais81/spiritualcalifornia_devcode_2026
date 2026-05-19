-- ─── Deactivate replaces Ban (and Archive) ──────────────────────────────────
-- Client-requested replacement: admins now Activate/Deactivate accounts
-- (any role, any status) instead of using Ban + the pending-guide Archive
-- flow. The User.isActive flag becomes the single source of truth for
-- "can this account log in / be surfaced publicly".
--
-- See docs/admin-activate-deactivate.md for the full design.

-- 1. New deactivation columns on User.
ALTER TABLE "users"
  ADD COLUMN "deactivatedAt"     TIMESTAMP(3),
  ADD COLUMN "deactivatedReason" TEXT,
  ADD COLUMN "deactivatedBy"     TEXT;

CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- 2. Migrate every currently-banned user into the deactivated state.
--    bannedReason → deactivatedReason; stamp deactivatedAt = now;
--    deactivatedBy left null (no actor record for historical bans).
UPDATE "users"
SET
  "isActive"          = false,
  "deactivatedAt"     = COALESCE("deactivatedAt", NOW()),
  "deactivatedReason" = COALESCE("deactivatedReason", "bannedReason", 'Migrated from banned status')
WHERE "isBanned" = true;

-- 3. Drop the old ban columns.
ALTER TABLE "users"
  DROP COLUMN "isBanned",
  DROP COLUMN "bannedReason";

-- 4. Drop the archive feature entirely (shipped 2026-05-18, replaced by
--    deactivate). Data in archived_guide_registrations was only test
--    rows; the User row drops cascade so dependents are clean.
DROP INDEX IF EXISTS "guide_profiles_archivedAt_idx";
ALTER TABLE "guide_profiles"
  DROP COLUMN IF EXISTS "archivedAt",
  DROP COLUMN IF EXISTS "archivedBy",
  DROP COLUMN IF EXISTS "archivedReason";
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "archivedAt";
DROP TABLE IF EXISTS "archived_guide_registrations";
