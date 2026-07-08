-- Practitioner engagement (2026-07-08)
--   * Blog "Applaud" clap tally on blog_posts (simple running total; the
--     client dedupes per-device via localStorage, so no per-user join).
--   * Seeker → Guide "Follow" (guide_follows join table).
-- See docs/practitioner-engagement.md for rationale.

-- ── Blog applause ────────────────────────────────────────────────
ALTER TABLE "blog_posts" ADD COLUMN "applauseCount" INTEGER NOT NULL DEFAULT 0;

-- ── Guide follows ────────────────────────────────────────────────
CREATE TABLE "guide_follows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guide_follows_userId_guideId_key" ON "guide_follows"("userId", "guideId");
CREATE INDEX "guide_follows_guideId_idx" ON "guide_follows"("guideId");

ALTER TABLE "guide_follows" ADD CONSTRAINT "guide_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guide_follows" ADD CONSTRAINT "guide_follows_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
