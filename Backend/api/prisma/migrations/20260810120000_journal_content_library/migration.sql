-- Journal content library: editorial articles alongside practitioner posts.
--
-- Three shape changes, all driven by client decisions recorded in
-- docs/journal-content-library-strategy.md §6a:
--
--   1. Posts live at a flat /journal/{slug} with no author segment, so `slug`
--      becomes globally unique instead of unique-per-guide.
--   2. Imported editorial articles belong to the publication, not to any
--      practitioner, so `guideId` becomes nullable. That relation cascades on
--      delete -- keeping it required would mean one guide-profile deletion
--      could take the whole imported library with it.
--   3. Authorship is recorded on every post via `authorUserId` -- the one thing
--      the client asked for, and the only thing the schema had no place for:
--      previously an author was reachable only through
--      guideId -> guide_profiles -> users, so an editorial post had no author
--      record at all.
--
-- Both new foreign keys are ON DELETE SET NULL, not CASCADE: deleting the admin
-- who wrote a post, or the category it sits in, must never delete the post.
-- That is the same lesson the pre-launch purge surfaced for guideId.
--
-- The unique index swap is safe against live data because blog_posts is empty
-- (all 9 rows removed in the 2026-08-04 purge), so no duplicate slug can exist.

-- CreateEnum
CREATE TYPE "AuthorKind" AS ENUM ('EDITORIAL', 'GUIDE');

-- CreateEnum
CREATE TYPE "ArticleSeries" AS ENUM ('JOURNAL', 'WHAT_TO_DO', 'CLINIC');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('HTML', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "Escalation" AS ENUM ('NONE', 'PRACTITIONER', 'CLINICIAN', 'URGENT');

-- DropIndex
DROP INDEX "blog_posts_guideId_slug_key";

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "authorKind" "AuthorKind" NOT NULL DEFAULT 'GUIDE',
ADD COLUMN     "authorName" TEXT,
ADD COLUMN     "authorRole" TEXT,
ADD COLUMN     "authorUserId" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "categoryLabel" TEXT,
ADD COLUMN     "contentFormat" "ContentFormat" NOT NULL DEFAULT 'HTML',
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "dek" TEXT,
ADD COLUMN     "escalation" "Escalation",
ADD COLUMN     "evidenceTier" TEXT,
ADD COLUMN     "healthAdjacent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "heroAlt" TEXT,
ADD COLUMN     "primaryTechnique" TEXT,
ADD COLUMN     "readTime" TEXT,
ADD COLUMN     "relatedModalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reviewCadence" TEXT,
ADD COLUMN     "routesTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "series" "ArticleSeries",
ADD COLUMN     "situation" TEXT,
ADD COLUMN     "sourcePath" TEXT,
ADD COLUMN     "sourcesCount" INTEGER,
ADD COLUMN     "timeToTry" TEXT,
ADD COLUMN     "verifiedAsOf" TIMESTAMP(3),
ALTER COLUMN "guideId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_sourcePath_key" ON "blog_posts"("sourcePath");

-- CreateIndex
CREATE INDEX "blog_posts_authorKind_series_idx" ON "blog_posts"("authorKind", "series");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

