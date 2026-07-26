# Seeker Favorites — the missing "save" entry point (2026-07-26)

Client-reported: `/seeker/dashboard/favorites` always showed **0 saved guides**
and no guide links, for every seeker.

## Cause

Nothing was broken on the page. The favorites feature was built end-to-end
*except* for the one control that creates a favorite:

| Piece | State |
|---|---|
| `Favorite` model (`@@unique([seekerId, guideId])`) | ✅ exists since `20260310084158_init` |
| `GET /seekers/favorites` | ✅ works |
| `POST /seekers/favorites/:guideId` | ✅ works — **never called by any UI** |
| `DELETE /seekers/favorites/:guideId` | ✅ works |
| Favorites dashboard page (list, View/Book/Remove) | ✅ fully built |
| A way to *add* a favorite | ❌ **did not exist anywhere** |

A repo-wide search for `seekers/favorites` returned exactly two call sites,
both in the dashboard page: the `GET` and the `DELETE`. The guide profile
(`/guides/[slug]`) and practitioners listing (`/practitioners`) had no save
control of any kind. So no `Favorite` row could ever be created and the page
was permanently empty — while its own empty state told seekers to "Browse
practitioners and save the ones you love."

Same class of defect as the dead Follow button (`docs/practitioner-engagement.md`):
backend complete, UI entry point missing.

## Fix

New `components/public/guides/FavoriteGuideButton.tsx`, mounted in two places:

- **Guide profile** — full CTA (`♡ Save to Favorites` / `♥ Saved`) in the
  right-hand CTA column under "Book a Session".
- **Practitioners listing** — `variant="icon"` heart pinned top-right of each
  card's cover image.

Behaviour:

- **Role-gated.** The endpoints are `@Roles(Role.SEEKER)`; guides and admins
  have no seeker profile and would get a 403, so the button does not render for
  them. Anonymous visitors *do* see it and are sent to
  `/signin?redirect=<current path>`.
- **Optimistic toggle**, reverts on failure.
- **409 handling.** `addFavorite` throws `ConflictException` when the row
  already exists (e.g. saved in another tab). The user's intent was to save and
  it *is* saved, so a 409 keeps the saved state rather than reverting it.
- **Card-click safety.** The practitioner card is itself a `<Link>`, so the
  icon button calls `preventDefault()` + `stopPropagation()` — saving does not
  navigate to the profile.

### Shared favorites request

There is no per-guide status endpoint, so a button has to read the whole list
to know if its guide is saved. With one button per card, that would have been
N identical `GET /seekers/favorites` calls on the listing page. Instances share
a single in-flight promise (`loadFavoriteIds()`), and any save/unsave calls
`invalidateFavorites()` so the next read is fresh. The cache is also dropped
when the user is signed out, so a second seeker signing in to the same tab
doesn't inherit the first one's saved set.

If favorites grow a per-guide status endpoint later
(cf. `GET /guides/:id/follow-status`), this shared cache is what to replace.

## Not covered

`ProductCard` in the shop carries its own `♡` "Wishlist button" that is still
dead markup with no handler — a **separate** feature with no backend at all
(no wishlist model or endpoints). Left as-is; it is not part of seeker
favorites. Worth either building or hiding, like Send Message was.
