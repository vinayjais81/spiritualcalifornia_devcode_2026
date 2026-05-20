-- ─── Postgres Full-Text Search ──────────────────────────────────────────────
-- Adds a `searchVector tsvector` column + BEFORE INSERT/UPDATE trigger to
-- each of the five searchable entities. (Generated columns would be
-- cleaner but Postgres rejects to_tsvector('english', ...) inside them —
-- the function is STABLE not IMMUTABLE, and that propagates through
-- IMMUTABLE wrappers in 12+ for generated-column verification.)
--
-- Triggers handle inserts + updates. Backfill statements at the bottom
-- populate the column for existing rows.
--
-- Per-field weights (A > B > C) so title/name matches rank higher than
-- body matches. Query side uses websearch_to_tsquery + ts_rank_cd. See
-- docs/postgres-fts.md for the full design.
--
-- Algolia code stays in the tree gated by ALGOLIA_ENABLED env (default
-- false from this point on); flipping it back on requires no schema change.

-- ─── 1. GuideProfile ────────────────────────────────────────────────────────
ALTER TABLE "guide_profiles" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION guide_profiles_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."displayName",  '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."tagline",      '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."bio",          '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW."location",     '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."modalities",   ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."issuesHelped", ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."languages",    ' '), '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER guide_profiles_search_vector_trg
BEFORE INSERT OR UPDATE ON "guide_profiles"
FOR EACH ROW EXECUTE FUNCTION guide_profiles_search_vector_update();

-- Backfill existing rows (touches every row → trigger runs)
UPDATE "guide_profiles" SET "displayName" = "displayName";

CREATE INDEX "guide_profiles_searchVector_idx" ON "guide_profiles" USING GIN ("searchVector");

-- ─── 2. Product ─────────────────────────────────────────────────────────────
ALTER TABLE "products" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION products_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."name",        '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'B') ||
    -- ProductCategory enum → text, replace underscores so "SOUND_HEALING"
    -- becomes "sound healing" and tokenizes naturally.
    setweight(to_tsvector('english', coalesce(replace(NEW."category"::text, '_', ' '), '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_vector_trg
BEFORE INSERT OR UPDATE ON "products"
FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

UPDATE "products" SET "name" = "name";

CREATE INDEX "products_searchVector_idx" ON "products" USING GIN ("searchVector");

-- ─── 3. Event ───────────────────────────────────────────────────────────────
ALTER TABLE "events" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION events_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title",       '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."location",    '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_search_vector_trg
BEFORE INSERT OR UPDATE ON "events"
FOR EACH ROW EXECUTE FUNCTION events_search_vector_update();

UPDATE "events" SET "title" = "title";

CREATE INDEX "events_searchVector_idx" ON "events" USING GIN ("searchVector");

-- ─── 4. SoulTour ────────────────────────────────────────────────────────────
ALTER TABLE "soul_tours" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION soul_tours_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title",       '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."shortDesc",   '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW."location",    '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."country",     '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER soul_tours_search_vector_trg
BEFORE INSERT OR UPDATE ON "soul_tours"
FOR EACH ROW EXECUTE FUNCTION soul_tours_search_vector_update();

UPDATE "soul_tours" SET "title" = "title";

CREATE INDEX "soul_tours_searchVector_idx" ON "soul_tours" USING GIN ("searchVector");

-- ─── 5. BlogPost ────────────────────────────────────────────────────────────
ALTER TABLE "blog_posts" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION blog_posts_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title",   '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."excerpt", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."content", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."tags", ' '), '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_search_vector_trg
BEFORE INSERT OR UPDATE ON "blog_posts"
FOR EACH ROW EXECUTE FUNCTION blog_posts_search_vector_update();

UPDATE "blog_posts" SET "title" = "title";

CREATE INDEX "blog_posts_searchVector_idx" ON "blog_posts" USING GIN ("searchVector");
