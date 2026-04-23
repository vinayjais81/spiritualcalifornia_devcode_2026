-- Admin-editable CMS pages (Privacy, Terms, About, Mission, ad-hoc /p/<slug>).
-- IF NOT EXISTS so environments that already ran `prisma db push` (local dev)
-- don't conflict when this migration is applied.

CREATE TABLE IF NOT EXISTS "static_pages" (
  "id"              TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "metaTitle"       TEXT,
  "metaDescription" TEXT,
  "eyebrow"         TEXT,
  "subtitle"        TEXT,
  "body"            TEXT NOT NULL,
  "isPublished"     BOOLEAN NOT NULL DEFAULT true,
  "publishedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "static_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "static_pages_slug_key" ON "static_pages"("slug");
