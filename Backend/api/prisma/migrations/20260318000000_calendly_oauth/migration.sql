-- AlterTable
ALTER TABLE "guide_profiles"
  ADD COLUMN "calendlyConnected"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "calendlyAccessToken"  TEXT,
  ADD COLUMN "calendlyRefreshToken" TEXT,
  ADD COLUMN "calendlyUserUri"      TEXT;
