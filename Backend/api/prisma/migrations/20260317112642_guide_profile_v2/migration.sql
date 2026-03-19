-- AlterTable
ALTER TABLE "guide_profiles" ADD COLUMN     "calendarLink" TEXT,
ADD COLUMN     "calendarType" TEXT,
ADD COLUMN     "issuesHelped" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "modalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sessionPricingJson" TEXT;
