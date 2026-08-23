-- Bring the schema in line with schema.prisma.
--
-- WHY THIS EXISTS
-- Production returned 500 on /api/v1/home with:
--     column soul_tours.trackType does not exist
-- The homepage journal scroller sits behind that endpoint, so the whole
-- section silently vanished.
--
-- Root cause: these fields were added to schema.prisma and pushed to QA with
-- `prisma db push`, which alters the database WITHOUT recording a migration.
-- QA therefore has the columns and works; production, built purely from the
-- migration history, does not. Any environment rebuilt from migrations would
-- have failed the same way.
--
-- Derived from `prisma migrate diff` against the live production database,
-- then reduced BY HAND to the additive statements only. The raw diff also
-- proposed 19 DROP INDEX and 9 DROP CONSTRAINT statements: those are false
-- positives, because several migrations create Postgres FTS and trigram
-- indexes through raw SQL that Prisma cannot model and therefore reports as
-- unwanted. Applying the diff unedited would have dropped the search indexes.
--
-- Contains no DROP COLUMN and no DROP TABLE — nothing here can lose data.

-- CreateEnum
CREATE TYPE "TourTrack" AS ENUM ('ADVENTURE', 'HEALING');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('CRYSTALS', 'SOUND_HEALING', 'AROMATHERAPY', 'BOOKS_COURSES', 'DIGITAL_DOWNLOADS', 'RITUAL_TOOLS', 'JEWELRY_MALAS', 'GIFT_BUNDLES', 'ART');

-- AlterEnum
-- Safe inside a transaction on PostgreSQL 12+ provided the new value is not
-- USED in the same transaction. It is not; only declared here.
ALTER TYPE "EventType" ADD VALUE 'RETREAT';

-- AlterTable
ALTER TABLE "guide_profiles" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "downloadUrlExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "category" "ProductCategory";

-- AlterTable
-- trackType drives the public Soul Travels listing tabs; its absence is what
-- produced the 500.
ALTER TABLE "soul_tours" ADD COLUMN "latestUpdate" TEXT,
                         ADD COLUMN "latestUpdateAt" TIMESTAMP(3),
                         ADD COLUMN "trackType" "TourTrack";

-- DELIBERATELY OMITTED: ALTER TABLE "soul_tours" ALTER COLUMN "languages" DROP DEFAULT
--
-- The diff proposed it because schema.prisma declares no default while the
-- database has one. Dropping it changes INSERT behaviour for any code path
-- relying on that default, and it has nothing to do with the outage being
-- fixed. A migration written to restore a broken page should not also carry
-- an unrelated behaviour change; that belongs in its own migration, decided
-- on its own merits.

