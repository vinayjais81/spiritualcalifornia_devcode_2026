# Spiritual California -- Journal Content Handoff

Everything a developer needs to ingest these articles into the site. Written to be
read by a human **and** pasted straight into Claude Code as context.

---

## The fastest handoff path (recommended)

**Git repo + Markdown files + one spec file. Nothing else.**

Because your developer is already running Claude Code, the fastest possible path is
*not* Google Docs, not a Word file, not a CMS. It is a folder of Markdown files with
YAML front matter committed into the site repo. Claude Code can then read the spec
and generate the templates/pages in a single pass, and every future article drops in
as one more file with zero re-explaining.

### Steps

1. **Create a folder in the site repo:** `content/journal/`
2. **Drop these files in:**
   - `00-HANDOFF.md` (this file)
   - `01-STYLE-SPEC.md` (the contract: front matter schema + HTML/CSS class mapping)
   - `02-ARTICLE-PLAN-50.md` (the editorial plan, so he can scaffold routes/categories up front)
   - `03-IMAGE-PROMPTS-50.md` (your ChatGPT prompts -- he needs the filenames)
   - `articles/*.md` (the articles themselves)
3. **Add images to** `public/images/journal/` using the exact filenames listed in
   `03-IMAGE-PROMPTS-50.md`. The front matter already points at those paths, so
   images wire themselves up.
4. **Send your developer this one message:**

> The journal content is in `content/journal/`. Read `01-STYLE-SPEC.md` first -- it
> defines the front matter schema and the exact class names to use so articles match
> the existing site styles. Then build the journal index + article template to render
> `articles/*.md`, and add a build step that fails if any article is missing a required
> front matter field or has a broken source link. Article images are in
> `public/images/journal/` with filenames matching the `heroImage` field.

That is the whole handoff. He runs Claude Code against the folder and the spec does
the explaining.

### Why this beats the alternatives

| Option | Verdict |
|---|---|
| **Markdown + YAML in repo** | Fastest. Version-controlled, diff-able, Claude Code native, no vendor lock-in, links stay live. **Do this.** |
| Google Docs / Word | Slowest. Every article needs manual re-formatting, hyperlinks break on paste, no way to validate. |
| Paste into a CMS by hand | 50 articles x ~15 min of copy-paste and link-checking = a wasted week. |
| Ready-made HTML files | Tempting, but it hard-codes today's markup. When the design changes you re-edit 50 files instead of one template. |

If you ever move to a real CMS (Sanity, Contentful, Payload), these same Markdown
files import cleanly -- the front matter maps 1:1 to CMS fields. Nothing is wasted.

---

## Delivery mechanics for you (non-technical, 5 minutes)

Pick whichever is least friction:

- **Best:** ask your developer for write access to the repo, or a `content` branch.
  Then you upload `.md` files through the GitHub web UI -- no command line needed.
- **Also fine:** zip the folder, send it once, and thereafter send only new
  `articles/*.md` files. The spec never needs re-sending.
- **Avoid:** sending article text in the body of an email or chat message. Hyperlinks
  and formatting die there, and that is the single biggest source of rework.

---

## What is in this package

| File | What it is |
|---|---|
| `01-STYLE-SPEC.md` | House style + front matter schema + HTML/class contract + editorial gate |
| `02-ARTICLE-PLAN-50.md` | All 50 articles: title, slug, category, evidence tier, image filename |
| `03-IMAGE-PROMPTS-50.md` | 50 ChatGPT image prompts with a locked style block for visual consistency |
| `articles/` | Finished articles. Three are complete as the reference standard for the rest. |

---

## Status: complete

**All 50 articles are written.** Every one carries live links to primary sources that were
looked up and verified during drafting -- not recalled. No citation in this library was
generated from memory.

Two evidence tiers were revised downward during writing, after reading the sources rather than
the reputations. Both revisions are marked visibly in `02-ARTICLE-PLAN-50.md` rather than
quietly corrected:

- **#29 Expressive Writing:** forecast A, filed as **B**. The effect shrank across successive
  meta-analyses (d = 0.47 in 1998, d = 0.075 by 2006), and several recent meta-analyses find
  nothing.
- **#35 Internal Family Systems:** forecast B, filed as **C**. Two randomized trials in thirty
  years, the stronger one using a mailed-leaflet comparator.

### Before publishing, the editor should read these six

Articles where the finding is likely to create friction with a listed practitioner, or where a
safety statement is load-bearing:

| # | Article | Why |
|---|---|---|
| 7 | Conscious Connected Breathwork | Placebo arm matched the intervention; full contraindication list; tetany |
| 10 | Chinese Herbal Medicine | Hepatotoxicity, adulteration, heavy metals |
| 15 | Craniosacral Therapy | Palpation fails inter-rater reliability; TBI contraindication |
| 40 | Cold Water Immersion | Arrhythmia window; cardiac contraindications; endorphin claim not supported |
| 45 | Ayurveda | 20.7% of products contained lead, mercury or arsenic |
| 31 | Hypnotherapy | Names past-life regression and recovered memory as hard stops |

### Two structural decisions that belong to the editor, not the writer

1. **Voice.** These 50 are editorial third-person. The site's existing journal posts are
   practitioner-voiced first-person. Both can coexist as separate series, but the index needs to
   be built knowing which is which.
2. **Evidence tiers are internal only.** The `evidenceTier` front matter field calibrates
   editorial language and **must not render** anywhere in the UI. Readers do not know what the
   tiers mean. Every article already states the strength of the evidence in plain prose.
