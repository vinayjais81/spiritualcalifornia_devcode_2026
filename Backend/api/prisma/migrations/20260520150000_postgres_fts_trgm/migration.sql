-- ─── Trigram typo tolerance for Postgres FTS ───────────────────────────────
-- Adds pg_trgm extension + GIN trigram indices on short identifier fields
-- (display names, titles, taglines). The PostgresSearchService queries
-- combine FTS matching against the existing searchVector with trigram
-- similarity matching against these fields, OR'd together so a typo'd
-- query like "soun heling" still finds "Sound Healing" practitioners.
--
-- Trigrams only cover short, query-able fields. Long bodies (bio,
-- description, content) stay FTS-only — trigrams on long text would
-- bloat the index and produce noisy matches.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GuideProfile: name + tagline are what users typically type
CREATE INDEX "guide_profiles_displayName_trgm_idx"
  ON "guide_profiles" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX "guide_profiles_tagline_trgm_idx"
  ON "guide_profiles" USING GIN ("tagline" gin_trgm_ops);

-- Product: name only — descriptions are FTS-only
CREATE INDEX "products_name_trgm_idx"
  ON "products" USING GIN ("name" gin_trgm_ops);

-- Event: title only
CREATE INDEX "events_title_trgm_idx"
  ON "events" USING GIN ("title" gin_trgm_ops);

-- SoulTour: title + shortDesc (the search-eligible short fields)
CREATE INDEX "soul_tours_title_trgm_idx"
  ON "soul_tours" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "soul_tours_shortDesc_trgm_idx"
  ON "soul_tours" USING GIN ("shortDesc" gin_trgm_ops);

-- BlogPost: title only
CREATE INDEX "blog_posts_title_trgm_idx"
  ON "blog_posts" USING GIN ("title" gin_trgm_ops);
