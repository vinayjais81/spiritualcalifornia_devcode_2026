-- ─── Admin-managed display sort order ──────────────────────────────────────
-- Adds a sortOrder column to four publishable resources so admins can
-- drag-to-reorder them in the admin panel. Defaults to 0 — all existing
-- rows tie until an admin reorders, at which point unique sortOrder values
-- are assigned (createdAt DESC remains the tiebreaker).
--
-- Surface usage:
--   - guide_profiles.sortOrder  → /practitioners public ORDER BY change
--   - blog_posts.sortOrder      → /journal public ORDER BY change
--   - events.sortOrder          → /admin/events only (public stays chronological)
--   - soul_tours.sortOrder      → /admin/tours only  (public stays chronological)
--
-- See docs/admin-sort-order.md for the full design.

ALTER TABLE "guide_profiles" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "blog_posts"     ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "events"         ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "soul_tours"     ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "guide_profiles_sortOrder_idx" ON "guide_profiles"("sortOrder");
CREATE INDEX "blog_posts_sortOrder_idx"     ON "blog_posts"("sortOrder");
CREATE INDEX "events_sortOrder_idx"         ON "events"("sortOrder");
CREATE INDEX "soul_tours_sortOrder_idx"     ON "soul_tours"("sortOrder");
