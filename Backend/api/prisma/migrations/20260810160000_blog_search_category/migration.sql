-- Add categoryLabel + dek to the blog search vector.
--
-- The original vector covered title / excerpt / content / tags, which was right
-- when every post was practitioner-written. The imported library adds two
-- fields that carry real search signal:
--
--   categoryLabel — the editorial topic ("Reiki", "Trauma Treatment"). Now a
--                   first-class filter in the journal UI, so it should be
--                   searchable too.
--   dek           — the authored standfirst. Currently mirrored into excerpt,
--                   but indexing it directly means the vector stays correct if
--                   the two ever diverge.
--
-- Both weighted B, alongside excerpt and tags: stronger than body copy, weaker
-- than the title.
--
-- The trailing no-op UPDATE re-fires the BEFORE trigger on every existing row,
-- which is what backfills the vector. Without it the 124 imported articles keep
-- the vector they were written with and none of this takes effect until each is
-- next edited.

CREATE OR REPLACE FUNCTION blog_posts_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title",         '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."excerpt",       '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."dek",           '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."categoryLabel", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."tags", ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."content",       '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Backfill: re-fire the trigger for every row.
UPDATE "blog_posts" SET "title" = "title";

-- Supports the category tab filter and the tab list's grouped count.
CREATE INDEX IF NOT EXISTS "blog_posts_categoryLabel_idx"
  ON "blog_posts" ("categoryLabel");
