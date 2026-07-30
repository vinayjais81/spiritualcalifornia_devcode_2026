# Practitioner Card — Nested Interactive Controls

Response to the QA defect *"No favorite/save control exists for practitioners,
despite a 'Favorite Guides' dashboard stat"* (severity: normal) —
[SpiritualCalifornia-playwright-testing#2](https://github.com/SvetlanaZap/SpiritualCalifornia-playwright-testing/issues/2).

## The favorites control already exists

It shipped on **26 July 2026** in commit `3820b03`
(`feat(favorites): add the missing save-to-favorites control`), documented in
[seeker-favorites.md](seeker-favorites.md). `FavoriteGuideButton` renders in
both places the report says it is missing:

- practitioners listing cards — `variant="icon"`, `aria-label="Save to favorites"` / `"Remove from favorites"`, `aria-pressed`
- practitioner profile pages — `variant="full"`, visible label "Save to Favorites"

**Confirmed live on QA** (`spiritualcalifornia.nityo.in`) by fetching the
deployed bundle for `/practitioners` and grepping the chunk it loads. All of
`Save to favorites`, `Remove from favorites`, `Save to Favorites`,
`aria-pressed`, `seekers/favorites` and `Sign in to save this practitioner` are
present in `/_next/static/chunks/5e423ac2d33e533c.js`.

So the report is against a build predating 26 July. **But it was also right for
a reason of its own** — see below.

## The real defect the scan was picking up

On the listing, the whole card **was** the `<Link>`, with the favorite
`<button>` nested inside it:

```tsx
<Link href={`/guides/${slug}`}>        {/* renders <a> */}
  …
  <FavoriteGuideButton variant="icon" />   {/* renders <button> */}
  …
  <span onClick={…}>Book</span>
</Link>
```

A `<button>` inside an `<a>` is **invalid HTML** — an anchor's content model is
transparent but must not contain interactive content. Browsers don't reparent it
the way they do nested anchors, so it renders and clicks work, which is why this
survived review. What it does break is the **accessibility tree**, where nested
interactive content is exposed inconsistently across engines.

That matters here specifically: Playwright's `getByRole` reads the accessibility
tree, not the DOM. So *"exhaustive getByRole/aria-label scan returns zero
matches"* is a plausible true observation about a button that was really on the
page. Two independent causes pointing at the same symptom.

The "Book" control was worse: a `<span onClick>` calling
`window.location.href`. Not focusable, no role, no accessible name — invisible
to keyboard users and to any control scan, by construction rather than by
accident.

## The fix

`Frontend/web/src/app/(public)/practitioners/page.tsx`, `PractitionerCard` —
switched to the stretched-link pattern:

- container is a plain `div` with `position: relative` (hover handlers moved here)
- the card-wide link is an absolutely positioned `<Link>` overlay,
  `inset: 0; z-index: 1`, carrying `aria-label="View {name}'s profile"`
- the favorite button and the Book link sit above it at `z-index: 2`
- "Book" is now a real `<Link href={/book/{slug}}>` with an aria-label

Result: no nested interactive content, one accessible name per control, and both
controls reachable by keyboard and by the accessibility tree.

## Not implemented: auto-favorite on booking

The report also notes that *"completing a real paid booking with a practitioner
does not add them as a favorite either."* That is working as intended and we
recommend keeping it.

Favorites are a user-curated shortlist. Auto-adding every booked practitioner
conflates "I saved this" with "I paid this once", fills the list with one-off
bookings the seeker never chose to keep, and has no natural inverse (you can't
un-book). Booking history already has its own dashboard surface. The
"Favorite Guides" stat is fed by the manual control, which is the correct
source.

## Same defect elsewhere — not fixed here

`Frontend/web/src/components/public/shop/ProductCard.tsx` has the identical
problem: two `<button>` elements (including a Quick Add with an `onClick`)
nested inside the card's `<Link>` at lines 64–138. Shop cards are outside the
scope of this issue, so it is reported rather than changed. It will misbehave in
the accessibility tree the same way and deserves its own ticket.

A useful grep, though it produces false positives (an already-closed `<Link>`
followed by an unrelated `<button>`) so results need eyeballing:

```bash
rg -U --multiline '<Link[^>]*>[\s\S]{0,3000}?<button' Frontend/web/src
```

## Note for the QA suite

`tests/ui/user/dashboard.spec.ts` → *"Booking a practitioner does not expose a
favorite or save control anywhere"* asserts the control is **absent**. It should
be inverted to assert the control is present, toggles, and persists to
`/seeker/dashboard/favorites`.

Worth retesting against a current build first — and note that a `getByRole`
scan finding nothing is not by itself proof the element is missing. It can also
mean the element is illegally nested, which is exactly what happened here.
