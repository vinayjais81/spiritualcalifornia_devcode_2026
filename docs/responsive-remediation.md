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

## Remaining phases (TODO)

- **Phase 2 (cont.) — page sweeps:**
  - **Detail** (guides/[slug], events/[id], tours/[slug], shop/[id], journal post)
    — stack content+sidebar (`.sc-stack-lg`/`-md`), wrap card rows, clamp headings.
  - **Listing** (practitioners, events, journal, shop, travels) — card grids to
    `.sc-cards-4/3`, fix the too-late 860/960px breakpoints, clamp hero paddings.
  - **Home sections** — minor padding clamps.
- **Phase 3 — Layout polish:** Navbar padding `14px 48px` → clamp; Footer padding.
- **Phase 4 — QA:** verify at 375 / 768 / 1024 widths on the live QA box.

## Verification

`tsc --noEmit` clean. Visual QA still required on real devices at the three
breakpoints — pending on QA (`spiritualcalifornia.nityo.in`).
