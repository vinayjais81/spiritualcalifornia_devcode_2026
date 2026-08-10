# Spiritual California -- Journal Style Spec

The contract. Every article in `articles/` conforms to this, and the site template is
built against it. If the two ever disagree, this file wins.

---

## 1. Front matter schema (YAML)

Required fields are marked **R**. A build step should fail on any missing **R** field.

```yaml
---
title:        "Sound Healing: What the Evidence Actually Supports"   # R -- max 70 chars
slug:         "sound-healing-evidence"                              # R -- kebab-case, stable forever
category:     "Sound Healing"                                       # R -- must match a modality in the site taxonomy
dek:          "One sentence, 20-30 words, that earns the click without overclaiming."  # R
author:       "Spiritual California Editorial"                      # R
authorRole:   "Reviewed against primary literature"
publishedAt:  "2026-08-04"                                          # R -- ISO 8601
updatedAt:    "2026-08-04"
readTime:     "7 min read"                                          # R
evidenceTier: "B"        # R -- INTERNAL EDITORIAL ONLY. A|B|C|D. **MUST NOT RENDER.** See §4.
heroImage:    "/images/journal/sound-healing-evidence.webp"         # R -- filename == slug
heroAlt:      "Descriptive alt text, no keyword stuffing."           # R
tags:         ["sound healing", "stress", "nervous system"]
relatedModalities: ["Meditation", "Music Therapy"]
healthAdjacent: true          # R -- if true, template appends the standing disclaimer
sourcesCount: 6                                                     # R
---
```

**Rules**

- `slug` is permanent. It is the URL. Never change it after publish -- add a redirect instead.
- `heroImage` filename is always `{slug}.webp`. This is what makes the image pipeline
  self-wiring: generate an image, name it after the slug, drop it in the folder, done.
- `healthAdjacent: true` triggers the disclaimer automatically. Do not hand-write
  disclaimers into article bodies.

---

## 2. Article body structure

Every article follows the same eight-beat shape. This is what makes 50 articles feel
like one publication rather than fifty freelancers.

| # | Section | Heading level | Length | Purpose |
|---|---|---|---|---|
| 1 | **Opening** (no heading) | -- | 100-150 words | A concrete scene or a real question. Never a definition. Never "In today's fast-paced world." |
| 2 | What it actually is | `##` | 150-250 | Plain description, including the honest origin story. |
| 3 | What the research shows | `##` | 300-450 | The core. Named studies, linked, with sample sizes and effect direction. |
| 4 | What it does not do | `##` | 150-250 | The trust-builder. Non-negotiable in every article. |
| 5 | What a session is like | `##` | 200-300 | Practical, sensory, specific. Cost range, duration, what to wear. |
| 6 | Who tends to find it useful | `##` | 120-200 | "People often seek it for..." framing only. |
| 7 | How to choose a practitioner | `##` | 120-200 | Credentials, red flags, questions to ask. |
| 8 | Sources | `##` | -- | Numbered list, full citation + live link. |

**Target length: 1,100-1,500 words.** Long enough to be the best page on the topic,
short enough for a professional to finish on one commute.

---

## 3. Voice: "easy to read, but written like a bestseller"

The two are not in tension. What makes bestselling non-fiction readable is not simple
ideas -- it is *concrete* ideas and *varied* rhythm.

**Do**

- Open on a specific image, person, or number. Never on an abstraction.
- Vary sentence length hard. A long, clause-carrying sentence, then four words.
- Prefer the concrete noun: "a 45-minute daily practice" beats "a regular commitment."
- Name the study author and year in the prose, not just the footnote. It reads as
  confidence and it doubles as a credibility signal.
- Use the double dash (`--`), never the em dash character.
- Let the honest limitation land as a *feature* of the piece. Readers trust writing
  that argues against itself.

**Do not**

- No "unlock," "journey," "transform your life," "ancient wisdom meets modern science,"
  "in today's fast-paced world," "let's dive in."
- No second-person hectoring ("You need to...").
- No rhetorical question stacks.
- No sentence that would survive unchanged on a competitor's page.

**One-line test:** would a skeptical VP of Engineering forward this to a colleague
without embarrassment? If not, it is not finished.

---

## 4. Evidence tiers -- INTERNAL ONLY (never shown to readers)

> These labels calibrate the language writers may use. They are **not** published, **not**
> rendered as a badge, and **must not** appear in article body text. Where an article needs to
> convey strength of evidence, it does so in prose -- typically a bolded
> **"Where the evidence stands."** line summarising the picture honestly.


| Tier | Meaning | Language you may use |
|---|---|---|
| **A** | Multiple RCTs / strong meta-analysis, replicated | "consistently shows," "well established" |
| **B** | Some RCTs, mixed or modest effects | "evidence suggests," "in several trials" |
| **C** | Preliminary, small, or low-quality studies only | "early research hints," "one small trial found" |
| **D** | Traditional practice, no supporting studies | "not supported by clinical studies," "some people find" |

**The citation gate: no citation, no claim.** Every A/B/C statement carries a link to
the primary source. Tier D statements say so in plain words.

**Banned regardless of tier:** cure, treat, prevent, diagnose, heal you, guaranteed,
miracle, secret, detoxify, rewire your brain (unless quoting a study's own language).

**Linking rule.** Link to the DOI landing page, the PubMed record, or the publisher's
full-text page -- in that order of preference. Never link to a press release, a
practitioner blog, or a "10 studies prove" listicle. Every link gets checked at build.

---

## 5. HTML / CSS class contract

Match the existing site system: **Cormorant Garamond** (display) + **DM Sans** (body),
palette of **deep terracotta / sage green / warmed linen**. Reuse the existing shared
CSS -- do not introduce article-only variables.

Markdown renders to:

```html
<article class="journal-article">
  <header class="journal-article__header">
    <p class="journal-article__category">{category}</p>          <!-- DM Sans, uppercase, letterspaced, terracotta -->
    <h1 class="journal-article__title">{title}</h1>              <!-- Cormorant Garamond -->
    <p class="journal-article__dek">{dek}</p>                     <!-- Cormorant Garamond italic -->
    <p class="journal-article__meta">{author} · {readTime}</p>
  </header>

  <figure class="journal-article__hero">
    <img src="{heroImage}" alt="{heroAlt}" loading="eager" width="1536" height="1024">
  </figure>

  <div class="journal-article__body">
    <!-- h2 -> .journal-article__h2 (Cormorant Garamond, sage rule above) -->
    <!-- p  -> DM Sans, max-width 68ch, line-height 1.7 -->
    <!-- a  -> .journal-link (terracotta, 1px underline, external links get rel="noopener") -->
    <!-- blockquote -> .journal-pullquote (Cormorant Garamond italic, sage left rule) -->
  </div>

  <section class="journal-article__sources">
    <h2>Sources</h2>
    <ol>...</ol>
  </section>

  <p class="journal-article__disclaimer">…</p>  <!-- rendered only if healthAdjacent: true -->
  <aside class="journal-article__cta">…</aside> <!-- one CTA, links to matching practitioners -->
</article>
```

**Notes for whoever builds the template**

- **Do not render `evidenceTier` anywhere in the UI.** It is internal editorial metadata used
  to keep the library's language calibrated. Readers do not know what the tiers mean and the
  labels do not appear in article text. The fact-first positioning is carried by the prose --
  every article states plainly how strong the evidence is, in words.
- All external links: `target="_blank" rel="noopener noreferrer"`.
- Body copy caps at ~68 characters per line. Wider than that and the Cormorant
  headings stop feeling editorial.
- Hero images are 3:2 (1536 x 1024), served as `.webp`, with a `.png` fallback.

---

## 6. Standing disclaimer

Rendered by the template, never typed into an article:

> Educational content, not medical advice. Talk to a qualified provider about your
> situation.

---

## 7. Pre-publish gate

Nothing ships until all eight are true.

- [ ] All required front matter fields present; `slug` matches `heroImage` filename.
- [ ] Every factual claim carries a tier-appropriate verb, and every A/B/C claim links to a primary source.
- [ ] A "What it does not do" section exists and says something a practitioner would find uncomfortable.
- [ ] Zero banned words. Zero medical claims.
- [ ] Every link resolves (automated check).
- [ ] Any quotation is attributed to a verified source -- no unsourced Rumi, Buddha, or Einstein.
- [ ] One CTA, maximum, and it is not pushy.
- [ ] Hero image exists at the specified path and carries the logo lockup.
