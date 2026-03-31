-- AlterTable: Add missing guide_profiles columns
ALTER TABLE "guide_profiles"
  ADD COLUMN "studioName" TEXT,
  ADD COLUMN "streetAddress" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "zipCode" TEXT,
  ADD COLUMN "country" TEXT DEFAULT 'United States',
  ADD COLUMN "yearsExperience" INTEGER;

-- AlterTable: Add missing products column
ALTER TABLE "products"
  ADD COLUMN "digitalFiles" JSONB;
