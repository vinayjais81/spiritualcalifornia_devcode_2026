-- Taxonomy gaps blocking the Bay Area practitioner import (2026-07-31)
--
-- Five of the client's 15 modality sheets have no subcategory to map onto —
-- including the largest, Somatic Healers (108 rows). Without these, ~140
-- imported practitioners would land uncategorised and be invisible to the
-- /practitioners modality filter, which matches on subcategories.
--
-- Applied as a migration rather than a seed edit because `npm run seed` is not
-- part of the deploy (only `seed:pages` is), so a seed-only change would never
-- reach QA or production. seed.ts is updated in the same commit so fresh local
-- databases match.
--
-- The Doulas sheet is deliberately split across two categories: birth doulas
-- belong with Family & Children, end-of-life doulas do not. The sheet carries a
-- Type column, so the importer can route each row correctly.
--
-- "Plant Medicine Integration" is named for what is lawful and what these
-- practitioners actually offer — integration support before and after an
-- experience, not the provision of any substance. Do not rename it to anything
-- that implies otherwise.
--
-- See docs/practitioner-import-invite-strategy.md §6.

INSERT INTO "subcategories" ("id", "categoryId", "name", "slug", "isApproved", "isCustom", "createdAt")
SELECT
  gen_random_uuid()::text,
  c."id",
  v."name",
  v."slug",
  true,
  false,
  CURRENT_TIMESTAMP
FROM (VALUES
  ('body-healing',    'Somatic Therapy',            'somatic-therapy'),
  ('body-healing',    'Massage & Bodywork',         'massage-bodywork'),
  ('family-children', 'Birth Doula',                'birth-doula'),
  ('soul-spirit',     'End-of-Life Doula',          'end-of-life-doula'),
  ('soul-spirit',     'Plant Medicine Integration', 'plant-medicine-integration'),
  ('integrative-health', 'Tibetan Medicine',        'tibetan-medicine')
) AS v("categorySlug", "name", "slug")
JOIN "categories" c ON c."slug" = v."categorySlug"
ON CONFLICT ("categoryId", "slug") DO NOTHING;
