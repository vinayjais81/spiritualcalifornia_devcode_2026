# Local corrections to the delivered content package

This folder is a copy of the client's `spiritual-california-content` package
(built 3 August 2026), and is the **source of truth** for the imported articles.
`scripts/import-articles.ts` reads from here; re-running the importer after
editing a file updates that post in place.

Every deviation from the delivered package is recorded below. Nothing is
changed silently, and **no editorial change is made here** — content decisions
belong to the client. Corrections are limited to mechanical defects that would
break the site.

---

## 1. Broken internal link — `what-to-do/feel-unseen-at-work.md`

**Found:** 2026-08-10, by the importer's internal-link validation.

The article linked to `/what-to-do/being-competent-and-bored`, which does not
exist. The intended article is real and present — its slug is
`competent-and-bored`, confirmed by both `07-MASTER-ARTICLE-LIST.md` (row G4)
and `bundles/MANIFEST.csv`. The link text already read "being competent and
bored", so the `being-` prefix appears to have been carried into the URL by
mistake.

```diff
- [being competent and bored](/what-to-do/being-competent-and-bored)
+ [being competent and bored](/what-to-do/competent-and-bored)
```

This is a URL typo, not an editorial change: it alters no wording, no claim and
no meaning, and it restores the link the sentence plainly intends. Left
uncorrected, a reader following it would hit a 404 mid-paragraph.

The client's own `00-DEV-README.md` notes the link checker had **not yet been
run** across the ~700 external and 255 internal citations. This was the only
internal link of the 255 that failed.

> **For the client:** worth confirming this is the intended target rather than a
> planned article that was renamed. If a separate "being competent and bored"
> piece is coming, this should point there instead.

---

## Import notes (not defects)

- All 124 articles otherwise validate clean: required frontmatter present,
  slugs match filenames, `heroImage` filenames match slugs, `evidenceTier`
  correctly absent from all 41 What To Do articles.
- 159 internal links to `/clinic/…` and `/what-to-do/…` are rewritten to
  `/journal/…` **at import time**, not here — the source files keep the
  original series prefixes so they stay portable if the routing decision ever
  changes. All 124 slugs are globally unique, so the rewrite is lossless.
- External citations have **not** been link-checked. ~700 of them.
