-- Supplemental: adds sortOrder to products. The 14:00:00 migration earlier
-- today shipped sortOrder on guide_profiles / blog_posts / events / soul_tours
-- but missed products. PR 2 of the admin sort-order rollout (/admin/products)
-- needs it, so we add it here in a separate migration rather than editing the
-- already-applied 14:00:00 one.

ALTER TABLE "products" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "products_sortOrder_idx" ON "products"("sortOrder");
