# Legal pages — CMS pattern

How `/terms`, `/privacy`, `/refund-policy`, and `/travel-disclosures` work,
and how to add a new one. Adopted across 2026-04-23 → 2026-05-25.

## Architecture in one paragraph

Every legal page is a `StaticPage` row in Postgres (`slug` is the unique key).
Content is HTML produced by the admin's Tiptap rich-text editor at
`/admin/static-pages`. The public side has two ways to render a page:

| URL shape | When it's used |
|---|---|
| `/<slug>` (e.g. `/refund-policy`) | A dedicated 30-line route wrapper exists for each "branded" legal URL. |
| `/p/<slug>` | The catch-all under `app/p/[slug]/page.tsx` for any other CMS page that hasn't been promoted to a vanity URL. |

Both routes call `fetchStaticPage(slug)` and render through the shared
`StaticPageRenderer`. The dedicated route just gives a nicer URL — there's
no other functional difference.

## Files in play

| File | Purpose |
|---|---|
| `Backend/api/prisma/schema.prisma` — `model StaticPage` | Single source of truth for the row shape |
| `Backend/api/src/modules/admin/...` (existing) | Backend CRUD for the row |
| `Frontend/web/src/lib/staticPages.ts` | `fetchStaticPage(slug)` — ISR-cached lookup, 5-min window |
| `Frontend/web/src/components/public/static/StaticPageRenderer.tsx` | Universal renderer: legal or marketing chrome, scoped `.static-page-body` typography |
| `Frontend/web/src/app/<slug>/page.tsx` | Per-page route wrapper (one file per vanity URL) |
| `Frontend/web/src/app/p/[slug]/page.tsx` | Catch-all for unbranded slugs |
| `Frontend/web/src/components/public/layout/Footer.tsx` — `legalLinks` array | Footer's bottom-bar nav |
| `Frontend/web/src/middleware.ts` — `PUBLIC_SITE_PATHS` | Public-route allowlist; each vanity path needs an entry |

## Seeding content via migration

Two patterns, picked by whether a row for that slug is likely to already
exist on prod:

### Pattern A — `INSERT … ON CONFLICT (slug) DO NOTHING`

Use for **new** legal pages. Idempotent on first deploy; a no-op on every
re-run AND on any environment where an admin has already created/edited
the row through the CMS. Admin's content always wins.

Examples: `20260525120000_seed_refund_policy`,
`20260525130000_seed_travel_disclosures`.

### Pattern B — `INSERT … ON CONFLICT (slug) DO UPDATE`

Use only when the slug **definitely already exists** in every environment
(stub from an earlier import, prior version of the content) and the new
copy is the authoritative replacement. **Overwrites** any prior admin
edits on the next deploy.

Example: `20260525140000_seed_privacy_policy` (the `privacy` row was
bootstrapped on 2026-04-23 and lived in every environment).

Future admin edits stay safe either way: Prisma migrations only run once
per environment.

### Migration template

```sql
INSERT INTO "static_pages" (
  "id", "slug", "title", "metaTitle", "metaDescription",
  "eyebrow", "subtitle", "body",
  "isPublished", "publishedAt", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  '<slug>',
  '<Title>',
  '<Title> | Spiritual California',
  '<Meta description>',
  '<Eyebrow>',
  '<Subtitle>',
  $body$
  <html body>
  $body$,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO NOTHING;  -- or DO UPDATE SET ... (Pattern B)
```

Dollar-quoted strings (`$body$ … $body$`) sidestep apostrophe / quote
escaping. UTF-8 (`§`, `—`, smart quotes) passes through cleanly.
`gen_random_uuid()::text` requires the `pgcrypto` extension (already
enabled across the project).

## HTML the renderer styles

`StaticPageRenderer` scopes typography to `.static-page-body`. Currently
styled tags:

`h2` `h3` `p` `ul` `ol` `li` `strong` `em` `a` `blockquote` `table` `thead`
`tbody` `tr` `th` `td` `hr`

Anything else falls back to browser defaults. If a new tag becomes common
(e.g. `dl` for definition lists, `figure` for images), add the rule to
the inline `<style>` block in `StaticPageRenderer.tsx` rather than
inlining styles in the CMS body.

## Recipe — add a new legal page

For a slug `<new-slug>`:

1. **Migration** — copy `20260525130000_seed_travel_disclosures/migration.sql`,
   bump the timestamp, swap the slug + title + body. Pattern A unless you
   know a row already exists.
2. **Route wrapper** — copy `Frontend/web/src/app/travel-disclosures/page.tsx`,
   change `SLUG` and the metadata fallbacks. 30 lines.
3. **Footer** — add `{ label: '<Label>', href: '/<new-slug>' }` to the
   `legalLinks` array in `Frontend/web/src/components/public/layout/Footer.tsx`.
4. **Middleware** — append `'/<new-slug>'` to `PUBLIC_SITE_PATHS` in
   `Frontend/web/src/middleware.ts`.
5. **Cross-link** (optional) — pass a `crossLink` prop to the renderer if
   another page is a natural sibling (travel-related docs cross-link
   each other; terms ↔ privacy stay paired by convention).
6. Run `npx prisma migrate deploy` locally, then `npx tsc --noEmit` in
   `Frontend/web` to verify.

## Current registry

| Slug | URL | Seed migration | Pattern | Cross-link |
|---|---|---|---|---|
| `terms` | `/terms` | (pre-existing) | — | `/privacy` |
| `privacy` | `/privacy` | `20260525140000_seed_privacy_policy` | B (UPDATE) | `/terms` |
| `refund-policy` | `/refund-policy` | `20260525120000_seed_refund_policy` | A (DO NOTHING) | `/travel-disclosures` |
| `travel-disclosures` | `/travel-disclosures` | `20260525130000_seed_travel_disclosures` | A (DO NOTHING) | `/refund-policy` |

## Live placeholder

The Refund Policy body contains a literal `$[ADMIN FEE]` placeholder in §2.
The policy author flagged it for admin to fill in before live payments
turn on. Admin should replace via `/admin/static-pages` once the
non-refundable deposit amount is set.

## Source PDFs from client

The four client-provided PDFs in `docs/` (Cancellation & Refund, Privacy,
Terms of Service, Travel Disclosures, Compliance Implementation Spec) are
the authoritative copy source. When the client sends a revised policy,
the workflow is:

1. Update the matching migration body? **No** — migrations are immutable
   once deployed. Instead, write a new dated migration with Pattern B
   (UPDATE) to overwrite the row, OR have admin paste the change via
   `/admin/static-pages` (preferred for small edits).
2. Replace the PDF in `docs/` for posterity.
