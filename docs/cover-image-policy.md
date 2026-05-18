# Cover-image rendering policy (Layer 1)

**Status:** Shipped 2026-05-18 (events + tours surfaces)
**Helper:** `Frontend/web/src/components/public/shared/CoverImage.tsx`

## The bug class

Guides upload cover images at unpredictable dimensions — phone portraits,
scans, ultra-wide banners. If the card UI lets the image dictate its own
height (only width constrained, height `auto`/unbounded), a tall portrait
upload stretches the card to 5× the intended size and breaks the listing
grid. The screenshot that motivated this work showed a soul-tour card
where one portrait shot dominated the entire viewport.

Root cause: using **`minHeight`** (a lower bound) instead of a fixed
**`aspect-ratio`** (a fixed shape). `object-fit: cover` only does its job
when the box has a fixed size — otherwise the image's natural dimensions
win.

## Fix

A `<CoverImage>` component that:

- wraps any URL in a fixed-aspect-ratio box,
- uses `object-fit: cover` to crop overflow,
- falls back to a placeholder when the URL is missing.

```tsx
<CoverImage
  src={event.coverImageUrl}
  alt={event.title}
  ratio="4 / 3"       // optional; defaults to '16 / 9'
  fallback="/images/yoga_outdoor.jpg"  // optional
/>
```

## What was swept in this PR

| Surface | What was wrong | What changed |
|---|---|---|
| `components/public/shared/TourImageCarousel.tsx` | `minHeight` prop on outer box → portrait uploads broke the listing | Replaced with `ratio` prop (default `3 / 2`); container now uses `aspect-ratio` |
| `app/(public)/travels/page.tsx` | Passed obsolete `minHeight={420}` | Now passes `ratio="3 / 2"` |
| `app/(public)/events/page.tsx` (EventCard) | `<img>` with `minHeight: 200` inside an unconstrained wrapper | Now renders `<CoverImage ratio="4 / 3" />` |

## What was checked and left alone (already constrained)

- `app/(public)/events/[id]/page.tsx` — hero has fixed `height: 320` + `objectFit: cover`.
- `app/(public)/tours/[slug]/page.tsx` — hero has fixed `height: 540` + absolute positioning.
- `components/public/shared/FeedCard.tsx` — fixed `height: '200px'` + `overflow: hidden`. (Used by home page widgets `EventsSection` and `SoulTravelsUpdates`.)
- `app/seeker/dashboard/tours/page.tsx` — `background: url(...) center/cover` on a fixed-width grid column; the box height is set by sibling text content, so portrait images cannot stretch it.
- `app/seeker/dashboard/events/page.tsx` — explicit `width: 64; height: 64` square thumbnail.
- `app/guide/dashboard/tours/page.tsx` — same `background: url(...) center/cover` pattern, safe by construction.

## Deferred to a follow-up sweep

Per the original scope ("ship Layer 1 for events + tours, leave the
others for follow-up"):

- Products (cards on shop pages — uses `imageUrls`, same bug class).
- Guide public profile sections (avatar is fine, but if any future hero
  surface displays cover images they should use `<CoverImage>`).
- Blog/journal cards (`PostCard`, `FeaturedHero`) — separate sweep.
- Practitioners listing cards.

## Future layers (not in this PR)

- **Layer 2 — upload-time validation.** Reject obviously wrong shapes
  (aspect ratio < 0.5 or > 3, min width 800px). Backend-side. Prevents
  future bad uploads.
- **Layer 3 — CDN auto-transform.** CloudFront / Lambda@Edge or imgix
  on-the-fly resize/crop. Performance + bandwidth win.
- **Layer 4 — in-browser cropper.** `react-easy-crop` in the upload UI
  so guides pick the focal point themselves. Best UX outcome.

Layer 1 (this PR) covers the visible-bug surface area; the rest are
quality-of-life improvements.
