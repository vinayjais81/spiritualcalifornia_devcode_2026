# Footer Dead Links

Removes the footer links in the "For Guides" column that had no destination.

Fixes the QA defect *"Footer Community and Guide Dashboard links resolve to 404
pages"* (severity: minor) —
[SpiritualCalifornia-playwright-testing#7](https://github.com/SvetlanaZap/SpiritualCalifornia-playwright-testing/issues/7).

## What was removed

`Frontend/web/src/components/public/layout/Footer.tsx`, `guidesLinks`:

| Label | href | State |
| --- | --- | --- |
| Community | `/community` | Route never built. Hard 404. |
| Guide Dashboard | `/dashboard` | Route never built. Hard 404. |
| Verification | `/guides/verification` | Route never built. **Not** a 404 — see below. |

The column now holds a single link, **List Your Practice** → `/onboarding/guide`.

## Two things the QA report didn't cover

**A third link was broken.** `/guides/verification` was not flagged, because it
doesn't 404. It falls through to the `guides/[slug]` dynamic route, which
fetches the guide, gets a 404 from the API, and renders a client-side
"not found" state — at **HTTP 200**. A status-code assertion sees a healthy
page. It is just as broken to a user as the other two.

> Worth generalising: on an App Router site with dynamic segments, a dead link
> under an existing prefix will usually render soft-404 content at 200. Status
> codes alone under-report broken navigation.

**"Guide Dashboard" was a different class of defect.** `/dashboard` doesn't
exist, but `/guide/dashboard` does and works — the href was simply missing its
prefix. So the option existed to repoint rather than remove. Removal was chosen
deliberately (2026-07-29): the "For Guides" footer column is aimed at
logged-out visitors, and `/guide/dashboard` is auth-gated, so the link would
bounce most people who clicked it to `/signin`.

If a guide-facing shortcut is wanted later, `/guide/dashboard` is the correct
target — re-add it behind an auth-aware condition rather than as a static
footer link.

## Verified

- Every remaining footer href checked against the App Router tree: the Explore,
  Company and legal rows all resolve.
- Grepped the whole frontend for `/community`, `/dashboard` and
  `/guides/verification` — no other component links to them. `Footer.tsx` is
  the only site footer (`AINonAdviceFooter` is an unrelated AI disclaimer).
- One stale reference remains in
  `app/auth/google/success/page-bk.tsx` (`router.replace('/dashboard')`). That
  file is a `-bk` backup, not a route — Next only routes `page.tsx` — so it has
  no user-facing effect. Left alone as dead code; delete it whenever that
  backup is cleaned up.

## Note for the QA suite

`tests/ui/guest/discovery.spec.ts` → *"Footer Community and Guide Dashboard
links resolve to 404 pages"* asserts the 404 **is present**, so it passes today
and **will now fail**. That failure is the fix landing, not a regression. The
test should be inverted to assert no footer link 404s — and ideally extended to
catch soft 404s too, since the `/guides/verification` case proves a 200 is not
proof of a working link.
