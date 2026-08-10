# Spiritual California — Developer Handoff

**Read this first. It is written for whoever (or whatever) is building the site.**

124 finished articles across three content series, plus the specs that define how they should
render. Everything is Markdown with YAML frontmatter. No CMS, no database, no proprietary format.

---

## ⚠️ Two things that will bite you if you skip this section

### 1. The images do not exist yet

Every article's frontmatter contains a `heroImage` path like
`/images/journal/mindfulness-meditation-eight-weeks.webp`. **None of those files have been
created.** The image generation is a separate workstream that has not started.

**Do not** strip the fields — the paths are correct and final, and the images will land at exactly
those locations. **Do** make the article template degrade gracefully:

```jsx
{heroImage && imageExists(heroImage)
  ? <img src={heroImage} alt={heroAlt} width={1536} height={1024} loading="eager" />
  : <div className="journal-article__hero-placeholder" aria-hidden="true" />}
```

A neutral placeholder block at the correct 3:2 aspect ratio prevents layout shift when the real
images arrive. `MANIFEST.csv` lists every required filename — it doubles as the checklist for the
image workstream.

### 2. `evidenceTier` must never render

Every article carries `evidenceTier: "A" | "B" | "C" | "D"` in its frontmatter.

**This is internal editorial metadata. It must not appear anywhere in the UI.** No badge, no
label, no colour code, no tooltip. Readers do not know what the tiers mean and the labels appear
nowhere in the article text. Strength of evidence is communicated in prose, usually in a bolded
**"Where the evidence stands."** paragraph.

Keep the field — it is used editorially to calibrate language as new articles are commissioned.
Just do not display it.

---

## What is in this package

```
sc-journal/
├── 00-DEV-README.md            ← you are here
├── 00-HANDOFF.md               ← original handoff notes
├── 01-STYLE-SPEC.md            ← ★ THE CONTRACT: frontmatter schema + HTML/CSS classes
├── 02-ARTICLE-PLAN-50.md       ← editorial plan for the journal series
├── 04-WHAT-TO-DO-SERIES-PLAN.md
├── 05-CLINIC-SERIES-PLAN.md
├── 06-IMAGE-STYLE-V2.md        ← image style guide + exact brand hex
├── 07-MASTER-ARTICLE-LIST.md   ← ★ all 124 articles, status, editorial concerns
│
├── articles/       (50 .md)    → content/journal/      → route /journal/{slug}
├── what-to-do/     (41 .md)    → content/what-to-do/   → route /what-to-do/{slug}
├── clinic/         (33 .md)    → content/clinic/       → route /clinic/{slug}
│
└── bundles/
    ├── BUNDLE-journal.md       (524 KB — all 50, concatenated)
    ├── BUNDLE-what-to-do.md    (215 KB — all 41)
    ├── BUNDLE-clinic.md        (400 KB — all 33)
    ├── BUNDLE-ALL-124.md       (1.1 MB — everything; see size warning below)
    ├── split-bundles.py        (reconstructs individual files from any bundle)
    └── MANIFEST.csv            (every article + its required image filename)
```

**Use the individual `.md` files.** The bundles exist only for pasting into a chat context or for
transferring through a channel that mangles folder structures.

> **Size warning:** `BUNDLE-ALL-124.md` is ~1.2 MB, roughly **290,000 tokens**. It will not fit in
> most context windows. Read one series bundle at a time, or better, read individual files.

To reconstruct files from a bundle:
```bash
python3 bundles/split-bundles.py bundles/BUNDLE-journal.md ./output-dir/
```

---

## The routes

| Series | Folder | Route prefix | Count |
|---|---|---|---|
| The Journal | `articles/` | `/journal/{slug}` | 50 |
| What To Do | `what-to-do/` | `/what-to-do/{slug}` | 41 |
| The Clinic | `clinic/` | `/clinic/{slug}` | 33 |

**Cross-links between articles already use these exact paths.** There are several hundred internal
links in the format `[text](/journal/some-slug)`. If you change a route prefix, they all break.

`slug` in the frontmatter always equals the filename stem. It is the permanent URL — never change
one; add a redirect instead.

---

## Frontmatter schema

Full spec in `01-STYLE-SPEC.md` §1.

**Required in ALL 124 files:**

```yaml
title, slug, dek, author, publishedAt, readTime,
heroImage, heroAlt, category, tags, healthAdjacent
```

**Series-specific — validate these conditionally, not globally:**

| Field | journal | what-to-do | clinic |
|---|:---:|:---:|:---:|
| `evidenceTier` | ✅ required | ❌ **absent by design** | ✅ required |
| `series` | — | ✅ | ✅ |
| `situation`, `timeToTry`, `primaryTechnique`, `routesTo`, `escalation` | — | ✅ | — |
| `verifiedAsOf` | — | — | some |
| `reviewCadence` | — | — | 2 articles |

> **`evidenceTier` is deliberately absent from all 41 What To Do articles.** The tier concept was
> withdrawn from that series — those articles are read mid-problem, on a phone, and a strength-of-
> evidence label would be noise. Do not add the field and do not fail the build on its absence
> there. (It must not render for the other two series either — see the top of this document.)

`healthAdjacent: true` should trigger a template-rendered disclaimer. **Do not hand-write
disclaimers into article bodies** — several already have inline ones where the topic demanded it,
but the standard footer is the template's job.

---

## Build steps worth adding

1. **Frontmatter validation** — fail the build if any required field is missing. All 124 currently
   validate clean; keep it that way.
2. **Link checker** — internal links (`/journal/...`) must resolve to an existing slug; external
   links should be checked periodically. **Not yet run.** There are ~700 external citations.
3. **Slug/filename consistency** — `slug` must equal the filename stem.
4. **`verifiedAsOf` staleness warning** — see below.

---

## ⏰ The two time-sensitive articles

`clinic/psilocybin-assisted-therapy.md` and `clinic/mdma-assisted-therapy.md` carry:

```yaml
verifiedAsOf: "2026-08-03"
reviewCadence: "90 days"
```

Their regulatory content changes faster than a publishing calendar — an FDA approval decision on
psilocybin is plausible within months of that date. Both articles open with a visible shelf-life
warning.

**Please add a build warning when `verifiedAsOf` is more than 90 days old**, and surface the date
on the page itself. These are the only two articles in the library that can become actively wrong
rather than merely dated.

---

## 🚨 Blocking item before any What To Do article publishes

**There is no crisis resources page yet, and one is required.**

Many articles in the What To Do and Clinic series reference crisis support — several name suicidal
ideation directly, because their subject matter demanded it (caregiver strain, job loss, chronic
pain, bereavement, waiting on medical results).

The page needs:
- Current, verified crisis line numbers (988 Suicide & Crisis Lifeline, Crisis Text Line, Veterans
  Crisis Line, National Domestic Violence Hotline)
- No techniques, no modalities, no practitioner promotion, no CTA
- Plain, fast-loading design
- **Reachable from every article footer in the site**

The `escalation` frontmatter field (`none | practitioner | clinician | urgent`) can drive
footer emphasis.

---

## Styling

`01-STYLE-SPEC.md` §5 has the full HTML/class contract. Summary:

- **Cormorant Garamond** (display) + **DM Sans** (body)
- Brand orange: **`#F38519`** — extracted from the logo, exact
- Body copy max ~68 characters per line
- External links: `target="_blank" rel="noopener noreferrer"`
- Images: 3:2, 1536×1024, WebP with PNG fallback
- The logo is a **circle** — leave a circular quiet zone bottom-right, on a mid-value background

`06-IMAGE-STYLE-V2.md` has the full palette ramp and the image generation brief.

---

## One editorial note

Several articles contain findings that are commercially inconvenient for a wellness marketplace —
recommending free alternatives over paid sessions, disclosing industry funding, reporting that
treatments did not beat their controls. **This is deliberate and it is the point of the library.**

`07-MASTER-ARTICLE-LIST.md` flags every such article with 🔴 in the concern column. Do not soften
them in editing; if something needs to change, that is a decision for Lana, not a copy edit.

---

*Package built 3 August 2026. 124 articles, 164,429 words, 0 frontmatter errors.*
