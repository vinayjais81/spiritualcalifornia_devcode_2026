# Journal Content Library — Analysis & Implementation Strategy

**Status:** Analysis complete, awaiting decisions
**Package:** `spiritual-california-content` (built 3 Aug 2026 — 124 articles, 164,429 words)
**Author:** Engineering, 2026-08-05

---

## 1. What the client actually delivered

Not "some blog posts." A structured, three-series editorial library with a build
contract, an editorial calendar running to December 2028, and a deliberate
positioning strategy.

| Series | Folder | Route prefix | Count | Voice |
| --- | --- | --- | --- | --- |
| The Journal | `articles/` | `/journal/{slug}` | 50 | Editorial third-person |
| What To Do | `what-to-do/` | `/what-to-do/{slug}` | 41 | Situational, read mid-problem |
| The Clinic | `clinic/` | `/clinic/{slug}` | 33 | Evidence-based treatments |

Supporting specs: `01-STYLE-SPEC.md` (the contract — frontmatter schema, HTML/class
mapping, pre-publish gate), `07-MASTER-ARTICLE-LIST.md` (all 124 with editorial
concern flags), `06-IMAGE-STYLE-V2.md`, per-series plans, and `MANIFEST.csv`.

Measured, not assumed:

- **255 internal cross-links** — 143 `/clinic/`, 96 `/journal/`, 16 `/what-to-do/`
- **~700 external citations** to DOI / PubMed / publisher pages
- **`publishedAt` spans 2026-08-04 → 2028-12-26** — 21 in 2026, 51 in 2027, 52 in 2028
- **27 distinct `category` values** against 9 site categories and ~39 subcategories
- **124 `heroImage` paths, zero images** — that workstream has not started

---

## 2. The client's intent — conclusive summary

**The library is a trust asset, not content marketing.** Its purpose is to make
Spiritual California the most credible source on wellness modalities on the open
web, and to convert that credibility into practitioner bookings.

Five decisions in the package make the intent unambiguous:

1. **Evidence honesty is the product.** Articles report that treatments failed
   their controls, disclose industry funding, and recommend free alternatives over
   paid sessions. The dev README states this outright: *"Several articles contain
   findings that are commercially inconvenient for a wellness marketplace… This is
   deliberate and it is the point of the library."* Two evidence tiers were revised
   *downward* during writing and the revisions were published rather than quietly
   corrected.

2. **The credibility must not be worn as a badge.** `evidenceTier` (A/B/C/D) is
   required in the frontmatter and **must never render** — no badge, label, colour
   or tooltip. Strength of evidence is carried in prose. The client is buying
   trust through restraint, not through trust signals.

3. **Three series, three reader states.** The Journal is browsed (researching a
   modality). What To Do is read mid-problem on a phone at 3am. The Clinic is read
   when someone is deciding about treatment. Same library, different urgency — which
   is why `evidenceTier` was *withdrawn* from What To Do entirely: a strength-of-
   evidence label is noise to someone in distress.

4. **The library is an internally-linked graph, not a list.** 255 cross-links route
   readers between series — a What To Do article on a breakup routes to the Journal's
   expressive-writing piece and the Clinic's behavioural-activation piece. The value
   compounds only if the routes resolve.

5. **Safety is load-bearing.** Six articles are flagged 🔴 "editor must read before
   publishing." A crisis-resources page is declared a **hard blocker** for the entire
   What To Do series.

**What they want built:** a publication inside the marketplace — flat permanent URLs,
one CTA per article routing to matching practitioners, a template that applies house
style centrally, and a build that fails when content violates the contract.

---

## 3. The central architectural decision

The client's handoff assumes a **file-based static site**: `content/journal/`,
Next.js file routing, build-time validation. That assumption predates knowledge of
this platform. It conflicts with your requirement that superadmin, admin **and**
guides can author from the UI.

**Recommendation: Markdown in the repo as source of truth, imported into the
existing `BlogPost` table by an idempotent CLI. One rendering path, two author
kinds.**

| Approach | Verdict |
| --- | --- |
| **Pure file-based** (client's assumption) | Guides cannot author. Two listing pages, two search paths, no unified feed, no applause/follow. Rejected. |
| **Pure CMS paste** | Discards the git-versioned source, the build contract, and the link checker. 124 × 15 min of copy-paste. Rejected. |
| **Hybrid: files → importer → DB** | Content stays version-controlled and diff-able; rendering, search (Postgres FTS), applause, follows and admin moderation all reuse what exists. **Recommended.** |

The hybrid also preserves what the client cares about: the `.md` files remain the
canonical artefact, so a future move to Sanity/Payload imports cleanly, exactly as
their handoff argues.

---

## 4. Gaps between the package and the platform

Severity-ranked. Items 1–4 are blocking.

### 🔴 1. Route structure is incompatible

Current public route is `/journal/{guideSlug}/{postSlug}` — every post is nested
under its author. The package requires flat `/journal/{slug}`, and **255 internal
cross-links already hard-code the flat form**. `BlogPost` enforces
`@@unique([guideId, slug])`, so slugs are unique *per guide*, not globally — the
package requires globally permanent slugs.

→ Flat routes for all three series, global slug uniqueness, `/journal/{guideSlug}/{postSlug}`
retained as a redirect so existing practitioner links survive.

### 🔴 2. Scheduled publishing does not exist

`blog.service.ts` filters public reads on `isPublished: true` **only** — there is no
`publishedAt <= now` check — and `publishedAt` is hard-set to `new Date()` on
publish, so a future date cannot be expressed. Importing 124 articles as published
would dump the entire 2.5-year calendar on day one.

→ Add `publishedAt: { lte: new Date() }` to every public read, and allow the
importer to set future dates. No impact on guide posts, which always publish at
`now`.

### 🔴 3. `BlogPost.guideId` is required — editorial articles have no guide

All 124 are authored by "Spiritual California Editorial", not a practitioner. The
existing workaround (a lazily-created shell `GuideProfile` for admins, see
`resolveAuthorToGuideId`) is actively dangerous here: `BlogPost.guideId` cascades on
delete, so **removing that shell profile would destroy all 124 articles**.

→ Make `guideId` nullable and add `authorKind: EDITORIAL | GUIDE`. Editorial posts
carry `guideId = null` and are structurally immune to guide-profile lifecycle.

### 🔴 4. Crisis resources page — client-declared blocker

No What To Do article may publish before it exists. Requirements are specific:
verified crisis numbers (988 Lifeline, Crisis Text Line, Veterans Crisis Line,
National DV Hotline), no techniques, no practitioner promotion, no CTA, fast-loading,
and **reachable from every article footer**.

→ Ship as a `StaticPage` row plus route wrapper, per the existing legal-pages
pattern. The `escalation` field (`none | practitioner | clinician | urgent`) drives
footer emphasis.

### 🟠 5. Frontmatter has no home in the schema

Required across all 124: `dek`, `author`, `readTime`, `heroAlt`, `category`,
`healthAdjacent`. Series-specific: `evidenceTier` (journal + clinic only), `series`,
`situation`, `timeToTry`, `primaryTechnique`, `routesTo`, `escalation`,
`verifiedAsOf`, `reviewCadence`, `sourcesCount`, `relatedModalities`.

`BlogPost` today has none of these. Validation must be **conditional per series** —
`evidenceTier` is absent by design from all 41 What To Do articles and the build must
not fail on it.

### 🟠 6. Content format mismatch

Package ships Markdown. `BlogPost.content` is HTML and never Tiptap JSON (see
[blog-content-format.md](blog-content-format.md)).

→ Add `contentFormat: HTML | MARKDOWN`. Store editorial articles as Markdown and
render through a sanitising pipeline that emits the spec's class contract; guide
posts continue as HTML from the existing editor.

### 🟠 7. Taxonomy mismatch — 27 values, three different kinds

| Kind | Count | Examples | Resolution |
| --- | --- | --- | --- |
| Matches a site **category** | ~42 | Mind Healing, Body Healing, Life Coaching, Soul Travels | Direct map |
| Matches a site **subcategory/modality** | ~50 | Meditation, Breathwork, Reiki, Acupuncture, Yoga, Sound Healing | Map to parent category, keep modality as the display label |
| **Editorial-only, not in the marketplace** | ~32 | How Therapy Works, Getting Care, Trauma Treatment, Depression Treatment, Sleep Treatment, OCD Treatment | Editorial topic only — must **not** create marketplace categories |

This mapping also drives the "matching practitioners" CTA. An article on Trauma
Treatment has no marketplace category to route to and needs a considered fallback.

### 🟠 8. Style spec is stale against Design v6

The spec (§5) specifies **Cormorant Garamond** and brand orange **`#F38519`**. The
live system is **Playfair Display** and **`#F07814`** (Design v6 rebrand,
2026-06-19; `--font-cormorant` survives only as a legacy alias).

→ Follow the live design system. The spec's own instruction — *"Reuse the existing
shared CSS, do not introduce article-only variables"* — supports this; only the
literal values are out of date. Worth confirming with Lana, since `#F38519` is
described as "extracted from the logo, exact".

### 🟡 9. 124 hero images do not exist

→ Render a neutral 3:2 placeholder so layout does not shift when images land.
`MANIFEST.csv` is the checklist for that workstream.

### 🟡 10. Two time-sensitive articles

`clinic/psilocybin-assisted-therapy.md` and `clinic/mdma-assisted-therapy.md` carry
`verifiedAsOf` + `reviewCadence: 90 days`. These can become *actively wrong*, not
merely dated.

→ Surface the date on-page; warn in CI when `verifiedAsOf` is older than 90 days.

### 🟡 11. Voice separation

Client flags it explicitly: the 124 are editorial third-person, existing guide posts
are practitioner first-person, *"the index needs to be built knowing which is which."*

→ `authorKind` already separates them; the listing needs a visible distinction and
probably separate browse affordances.

### 🟡 12. Link integrity has never been checked

~700 external citations, never run. Internal links must resolve to an existing slug.

---

## 5. Proposed data model

```prisma
enum ArticleSeries { JOURNAL WHAT_TO_DO CLINIC }
enum AuthorKind    { EDITORIAL GUIDE }
enum ContentFormat { HTML MARKDOWN }
enum Escalation    { NONE PRACTITIONER CLINICIAN URGENT }

model BlogPost {
  // existing fields unchanged …
  guideId        String?        // was required — null for editorial
  authorKind     AuthorKind     @default(GUIDE)
  series         ArticleSeries?
  contentFormat  ContentFormat  @default(HTML)

  // Editorial frontmatter
  dek            String?
  authorName     String?
  authorRole     String?
  readTime       String?
  heroAlt        String?
  categoryLabel  String?        // display label, e.g. "Reiki"
  categoryId     String?        // resolved marketplace category, nullable
  relatedModalities String[]    @default([])
  healthAdjacent Boolean        @default(false)
  sourcesCount   Int?
  evidenceTier   String?        // STORED, NEVER SERIALISED TO PUBLIC API

  // What To Do only
  situation        String?
  timeToTry        String?
  primaryTechnique String?
  routesTo         String[] @default([])
  escalation       Escalation?

  // Clinic freshness
  verifiedAsOf   DateTime?
  reviewCadence  String?

  // Import bookkeeping — idempotent re-import
  sourcePath     String?  @unique
  contentHash    String?

  @@unique([series, slug])   // replaces @@unique([guideId, slug])
}
```

`evidenceTier` is stored but **stripped in the public serialiser**, so it cannot leak
through the API even by accident — a stronger guarantee than "don't render it".

---

## 6. Phased plan

**Phase 0 — Decisions** (below). Nothing else starts.

**Phase 1 — Schema & routes.** Migration, `authorKind`, nullable `guideId`, global
slug uniqueness, flat routes for three series, legacy redirect, `publishedAt <= now`
on every public read.

**Phase 2 — Importer.** `scripts/import-articles.ts` with `--mode=report|trial|execute`
mirroring the purge tool's safety model. Parses frontmatter, validates conditionally
per series, resolves taxonomy, verifies internal links, idempotent on
`sourcePath` + `contentHash`. Re-running after a content edit updates in place.

**Phase 3 — Templates.** Article template to the §5 class contract using live Design
v6 tokens; Markdown renderer; `healthAdjacent` disclaimer; image placeholder;
`verifiedAsOf` surfacing; one practitioner CTA.

**Phase 4 — Crisis page + footer.** Unblocks the What To Do series.

**Phase 5 — Indexes.** Three series landing pages, editorial/practitioner voice
separation, FTS coverage, cross-link resolution.

**Phase 6 — CI gates.** Frontmatter validation, slug/filename consistency, internal
link resolution, `verifiedAsOf` staleness warning, external link checker.

**Phase 7 — Images.** Wire `MANIFEST.csv` as filenames arrive.

---

## 7. Decisions needed before Phase 1

1. **Publishing calendar** — honour `publishedAt` as a genuine 2.5-year drip
   (recommended: it is clearly deliberate), publish all 124 immediately, or compress
   the schedule?
2. **Editorial-only categories** — 32 articles sit in clinical topics with no
   marketplace equivalent. Editorial-only taxonomy (recommended) or new categories?
3. **Practitioner CTA fallback** — what does an article on Trauma Treatment link to?
4. **Brand values** — confirm Playfair/`#F07814` over the spec's Cormorant/`#F38519`.
5. **Six 🔴 articles** — has Lana signed off on publishing them as written? The
   package is explicit that softening them is her call, not a copy edit.
6. **Guide authorship of editorial series** — can practitioners publish into
   `/clinic` and `/what-to-do`, or are those editorial-only with guides confined to
   `/journal`?

---

## 8. Related

- [blog-content-format.md](blog-content-format.md) — why content is HTML, never Tiptap JSON
- [legal-pages-cms.md](legal-pages-cms.md) — StaticPage + route wrapper pattern for the crisis page
- [design-v6-integration.md](design-v6-integration.md) — live brand tokens
- [postgres-fts.md](postgres-fts.md) — search indexing the new articles must join
- [pre-launch-data-purge.md](pre-launch-data-purge.md) — the journal is currently empty (all posts purged 2026-08-04)
