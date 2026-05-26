-- ─── Seed / update the About page StaticPage row ───────────────────────
--
-- Installs the client-finalized "Two Girls, One Vision" copy as the
-- source of truth for /about. The about slug has had a stub row
-- ("Wellness deserves trust", 4.4 KB) in every environment since the
-- original CMS bootstrap (2026-04-23), so this uses Pattern B
-- (INSERT ... ON CONFLICT DO UPDATE) — same approach as the
-- privacy/terms seeds, for the same reason.
--
-- Content source:
--   design/Spiritual_California_Website_Final_v2/spiritual_california_branded/about.html
-- shared by the client on 2026-05-26. Eyebrow + title match the
-- design page's .page-tag + .page-title; body uses only StaticPageRenderer-
-- supported tags (p / strong / em / blockquote) so the renderer's typography
-- handles all visual treatment — no inline styles needed.
--
-- After this migration, the four legal pages (terms, privacy,
-- refund-policy, travel-disclosures) plus /about all carry final client
-- copy. Future admin edits via /admin/static-pages stay safe because
-- Prisma migrations only run once per environment.

INSERT INTO "static_pages" (
  "id",
  "slug",
  "title",
  "metaTitle",
  "metaDescription",
  "eyebrow",
  "subtitle",
  "body",
  "isPublished",
  "publishedAt",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  'about',
  'Two Girls, One Vision',
  'Our Story — Spiritual California',
  'How two friends with the same name built a trusted marketplace connecting seekers with vetted wellness practitioners — light-workers, healers, and the people who need them.',
  'Our Story',
  NULL,
  $body$
<p>Spiritual California began with a simple, shared realization between two friends — who happen to share the exact same name.</p>

<p>We both looked at the world around us and saw the same paradox: people were more digitally connected than at any point in human history, yet profoundly disconnected from themselves, from each other, and from any sense of deeper meaning. The hunger for something real — something that could speak to the body, the mind, and the soul simultaneously — was everywhere. But the landscape of spiritual wellness was often confusing, unregulated, and intimidating to navigate.</p>

<blockquote>"We wanted to bring more light to the world. Not by adding noise, but by creating clarity — a trusted space where those who are searching can find those who can genuinely help."</blockquote>

<p>We envisioned a platform that could act as a trusted bridge. A place that connects seekers — people looking for gentle, responsible support on their journey — with the gifted practitioners who can provide it. Not just any practitioners, but those who have been vetted for their integrity, their skill, and above all, their heart.</p>

<p>Our journey has been about creating a sanctuary in the digital space. A place where the ancient and the modern meet gracefully. Where a busy entrepreneur in San Francisco can find a sound healer who speaks their language. Where a mother in Los Angeles can discover an Ayurvedic practitioner who understands her specific needs. Where a young person in Sacramento, quietly questioning everything, can find a meditation guide who will meet them exactly where they are.</p>

<p>We are not just building a directory. We are building a <strong>community of light-workers, healers, and seekers</strong> — bound together by the belief that the world becomes a better place when people have access to the support they need to heal, grow, and thrive.</p>

<p>We operate on the principle of <strong>conscious capitalism</strong>: the belief that business can be a force for profound good in the world. That profit and purpose are not opposites, but partners. That every transaction on our platform can be an act of care.</p>

<p>Two girls with the same name, the same dream, and an unshakeable conviction that the world needs more spaces like this.</p>

<p>Welcome to Spiritual California. We are so glad you are here.</p>
  $body$,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "title"           = EXCLUDED."title",
  "metaTitle"       = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "eyebrow"         = EXCLUDED."eyebrow",
  "subtitle"        = EXCLUDED."subtitle",
  "body"            = EXCLUDED."body",
  "isPublished"     = EXCLUDED."isPublished",
  "updatedAt"       = CURRENT_TIMESTAMP;
