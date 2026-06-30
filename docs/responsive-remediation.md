# Public Site Responsive Remediation

**Status:** IN PROGRESS — Phase 0 + Phase 1 shipped 2026-06-29 (client report:
"public website not responsive on mobile/tablet")
**Breakpoints (locked):** mobile **480** / tablet **768** / desktop **1024**
**Owner doc / tracker:** this file

## Background

The public site was built desktop-only. A 5-part audit (home, listing, detail,
commerce, foundation) found ~150 responsive defects across ~25 files, collapsing
into **6 root-cause patterns**:

1. Fixed two-column grids that never stack (`1fr 340px`, `1fr 360–420px`, `320px 1fr`).
2. Fixed side padding (`48–60px`) eating ~⅓ of a 375px screen.
3. Multi-column grids forced on mobile (`repeat(3–4,1fr)` cards, `1fr 1fr` forms).
4. Unscaled headings (`40–64px`, no `clamp()`).
5. Fixed-width flex children (carousel cards, image columns) that don't wrap.
6. **No global responsive foundation** — `globals.css` had zero breakpoints.

What was already fine: **Navbar** (hamburger + full-screen menu via Tailwind
`md:`), **Footer** (has media queries), home **HeroSection/SoulTravelsBanner**
(styled-jsx `@media`), `CoverImage` + `TourImageCarousel` (`aspect-ratio`).

## Key technical constraint

The pages are **heavily inline-styled**, and **React inline `style={{}}` cannot
hold `@media` rules** (silently ignored). So:

- **Paddings & font-sizes** → fixed in place with `clamp()` (valid inline).
- **Grid-column collapse / layout-direction toggles** → require **class-based**
  CSS. We added a small foundation of utility classes in `globals.css`; because
  inline styles outrank classes, the utilities use `!important` (an `!important`
  external longhand beats a non-important inline shorthand).

## Phase 0 — Foundation (DONE)

Added to `Frontend/web/src/app/globals.css` (one-time, reusable):

| Helper | Effect |
|--------|--------|
| `.sc-container` | width-cap 1200px + `margin-inline:auto` + fluid `padding-inline: clamp(16px,5vw,48px)` |
| `.sc-stack-lg` | two-col grid → 1 col at **≤1024** (wide 340–420px sidebars) |
| `.sc-stack-md` | two-col grid → 1 col at **≤768** (narrower sidebars / search rows) |
| `.sc-flex-col-md` | `flex-direction: column` at ≤768 |
| `.sc-cards-4` / `-3` / `-2` | card-grid ladder 4→3→2→1 (and 3→2→1, 2→1) across 1024/768/480 |
| `.sc-form2` | two-up form fields (`1fr 1fr`) → 1 col at ≤768 |
| `.sc-hide-md` | hide decorative elements at ≤768 |

Usage: add the class whose name matches the **desktop** layout; keep the inline
desktop style. The class only overrides at its breakpoint.

## Phase 1 — Shared components (DONE)

High leverage — these are reused across many pages, so one fix propagates widely.

| Component | Fix |
|-----------|-----|
| `Carousel.tsx` | outer padding `0 60px` → `0 clamp(12px,5vw,60px)`; arrow buttons `.sc-hide-md` (swipe on mobile) |
| `SectionHeader.tsx` | padding → clamp; heading `30px` → `clamp(20px,5vw,30px)` |
| `FeedCard.tsx` | width `300px` → `clamp(240px,78vw,300px)` (next card peeks on mobile) |
| `PractitionerCard.tsx` | width `180px` → `clamp(140px,42vw,180px)` |
| `UpdateCard.tsx` | width `280px` → `clamp(220px,74vw,280px)` |
| `ReviewsBlock.tsx` | container paddings → clamp; header `.sc-flex-col-md`; avg-rating `48px` → clamp; reviews grid `.sc-cards-2/3` |
| `SearchResultsList.tsx` | row grid `160px 1fr auto` → `.sc-stack-md` (stacks on mobile) |
| `GalleryLightbox.tsx` | overlay padding `60px 80px 100px` → clamp; prev/next offsets → clamp |

Carousel card widths read `offsetWidth` dynamically, so responsive widths don't
break the scroll math.

## Phase 2 — Commerce / checkout (DONE 2026-06-29)

All 9 flow pages: stacked the `1fr 320–420px` form+summary layouts with
`.sc-stack-lg` (collapse ≤1024), single-column form fields with `.sc-form2`
(≤768), and clamped the `32–48px` side paddings.

| File | Changes |
|------|---------|
| `cart` | `.sc-stack-lg` on items+summary; clamp padding (both states) |
| `checkout` | `.sc-stack-lg`; `.sc-form2` on contact + shipping grids; clamp padding |
| `checkout/event` | `.sc-stack-lg`; `.sc-form2` on attendee grid; clamp padding |
| `book/[guideSlug]` | `.sc-stack-lg`; `.sc-form2` on manual-time + contact grids; clamp padding |
| `tours/[slug]/book` | `.sc-stack-lg`; `.sc-form2` ×5 (departures, traveler, health, deposit, included); clamp paddings |
| `events/[id]/checkout` | `.sc-stack-lg` (conditional grid); `.sc-form2` on attendee; clamp padding |
| `downloads` | clamp paddings (loading + main) |
| `reviews/new` | clamp paddings (loading + main) |
| `verify-ticket/[id]` | `.sc-form2` on both detail grids |

Deferred minor items: book Calendly embed height (660px, tall but usable);
sticky-sidebar top offsets (acceptable once stacked).

## Phase 2 — Detail pages (DONE 2026-06-29)

| File | Changes |
|------|---------|
| `guides/[slug]` | main grid already had a working `@media(900px)` block — added: clamp header padding + name; `.sc-cards-2` on blog + testimonials grids; clamped event/tour card image widths |
| `events/[id]` | clamp container + card paddings; title → clamp; info grid `minmax(200→150px)` |
| `tours/[slug]` | hero `height:540` + paddings → clamp; title → clamp; main `1fr 380px` → `.sc-stack-lg`; highlights/included grids → `.sc-cards-2`; room card `1fr auto` → `.sc-stack-md` |
| `shop/[id]` | gallery+info `1fr 1fr` (+ skeleton) → `.sc-stack-md`; clamp paddings + gap; feature badges → `.sc-cards-2` |
| `journal/[guideSlug]/[postSlug]` | title/subtitle → clamp; hero image `height:520` → clamp; related posts `repeat(3)` → `.sc-cards-3` |

Note: `guides/[slug]` proved its main two-col layout was ALREADY responsive via
a styled-jsx `@media(max-width:900px)` block — only the secondary grids/headings
needed work.

## Phase 2 — Listing pages (DONE 2026-06-29)

| File | Changes |
|------|---------|
| `practitioners` | grids already responsive (existing `@media` 1100/900/768/560/480 block) — clamped AI-bar, header, filter-bar paddings + h1 |
| `events` | grids already responsive (`.events-layout` 960px, `.event-card-grid` 700px) — clamped hero padding + h1 |
| `journal` | both product grids `repeat(3)` (had NO media) → `.sc-cards-3`; clamp hero padding + h1 |
| `shop` | both product grids `repeat(4)` (had NO media) → `.sc-cards-4`; clamp container padding |
| `travels` | tour grid already collapses (`.tour-grid` @860px); clamped hero `minHeight:520`, padding, h1 `64px` |

Several listing pages already had partial `@media` blocks — the work was a mix
of adding `.sc-cards-*` (journal/shop) and clamping heros/headings the existing
blocks didn't cover.

## Phase 3 — Layout polish (DONE 2026-06-29)

- `Navbar` padding `14px 48px` → `14px clamp(16px,4vw,48px)`.
- `Footer` padding `56px 60px 36px` → clamp side padding.
- (Footer grid already collapsed via its own `@media`; Navbar hamburger already worked.)

## Phase 2 — Home polish (DONE 2026-06-29)

- HeroSection: hid the two decorative botanical background SVGs (460px / 300px,
  negative offsets) ≤768 via `.sc-hide-md`. Section paddings are horizontal-0
  (no overflow); HeroSection + SoulTravelsBanner already had their own `@media`.

## Remaining (TODO)

- **Phase 4 — QA:** verify at 375 / 768 / 1024 widths on the live QA box; fix
  any stragglers (targeted one-offs, no longer systemic).

## Phase 4 — QA fixes (in progress)

Mobile QA findings as they come in:

- **Home Practitioners carousel** (2026-06-30): (1) arrows were hidden on mobile
  via `.sc-hide-md` — restored (users want to navigate, not only swipe), moved to
  `left/right: 4px`; (2) `Carousel.scroll()` now **loops** — Next at the end wraps
  to the first card, Prev at the start wraps to the last; (3) `PractitionerCard`
  Verified badge was pinned bottom-right and clipped by the avatar's circular
  `overflow:hidden` (showed "Verifi…") — re-centered along the bottom arc.

## Status: code sweep COMPLETE pending visual device QA

Every public surface — shell, shared components, commerce/checkout, detail,
listing, home — now has fluid paddings/headings and grids that collapse at
480/768/1024. `tsc --noEmit` clean throughout.

## Verification

`tsc --noEmit` clean. Visual QA still required on real devices at the three
breakpoints — pending on QA (`spiritualcalifornia.nityo.in`).
