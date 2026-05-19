# Admin sort order — drag-to-reorder + click-to-sort

**Status:** PR 1 shipped 2026-05-19 (guides + blog). PR 2 (products), PR 3 (events admin), PR 4 (tours admin) pending.
**Migration:** `20260519140000_admin_sort_order`

## Patterns delivered

Two complementary patterns sit on every admin listing page that supports sorting:

| Pattern | When admin uses it | Where the effect surfaces |
|---|---|---|
| **A. Click-to-sort column headers** | "Find by name / rating / created date" | Admin view only |
| **B. Drag-to-reorder rows** | "Set the canonical display order" | Admin view AND public listing (where applicable) |

The two patterns are mutually exclusive in a given moment: when the admin is sorted by any column other than `sortOrder`, the grip handles are hidden (because dragging while sorted by, say, "Rating" would silently overwrite the user's manual order with a value that has no relationship to the visible row position).

## Schema

`20260519140000_admin_sort_order` adds an `Int` column (`default 0`, indexed) to four models:

| Model | Used by public listing? |
|---|---|
| `guide_profiles.sortOrder` | ✓ — `/practitioners` orders by `sortOrder ASC, averageRating DESC, totalReviews DESC` |
| `blog_posts.sortOrder` | ✓ — `/journal` orders by `sortOrder ASC, publishedAt DESC` |
| `events.sortOrder` | ✗ — admin-only. `/events` stays chronological |
| `soul_tours.sortOrder` | ✗ — admin-only. `/travels` stays chronological |

All existing rows ship with `sortOrder: 0` — they tie until an admin reorders, with the existing public sort acting as tiebreaker.

## Endpoints

**Listing endpoints accept** `sortBy` + `sortDir` query params:

- `GET /admin/guides?sortBy=sortOrder|displayName|createdAt|rating&sortDir=asc|desc`
- `GET /admin/blog?sortBy=sortOrder|title|publishedAt|createdAt&sortDir=asc|desc`

Default is `sortBy=sortOrder, sortDir=asc`. The order chain in the service falls back to a natural tiebreaker (`createdAt DESC` for guides, `publishedAt DESC` for blog) so unsorted rows still have stable ordering.

**Bulk reorder endpoints** (one per resource):

- `POST /admin/guides/reorder` body `{ rows: [{ id, sortOrder }] }`
- `POST /admin/blog/reorder` body `{ rows: [{ id, sortOrder }] }`

Writes are batched in a single Prisma transaction so the listing never reads a half-applied order. The frontend computes `sortOrder` values as `(page - 1) * pageSize + index`, which preserves cross-page ordering when admins reorder while paginated.

## Frontend

Shared component: [`<SortHeader>`](Frontend/web/src/components/admin/SortHeader.tsx) — clickable column header that toggles direction or switches column. Generic over the column-name type, so each page constrains its sort keys (e.g. `'sortOrder' | 'title' | 'publishedAt' | 'createdAt'` on blog).

Drag-to-reorder uses **native HTML5 drag-and-drop** — no library dependency. Each row carries `draggable={canReorder}`, the drag start writes the row id, drop swaps array positions, the mutation persists. Optimistic update keeps the new order visible until the server responds; if the mutation fails, `setOrderedIds(null)` rolls back to the server's truth.

`useEffect(() => setOrderedIds(null), [data])` resets the optimistic state every time the server returns fresh data, so we never display a stale local order after a real refresh.

## Why public events + tours intentionally ignore sortOrder

Events and tours have a natural chronological semantic on the public site ("upcoming retreats" suggests "soonest first"). Letting an admin pin an event below newer ones would be misleading to seekers searching for the next available date. The admin `sortOrder` columns exist on those models so admins can still organize their own catalog view, but `/events` and `/travels` keep sorting by `startTime ASC` / next-departure date.

If a future requirement wants to surface a curated featured-events list on the home page that DOES respect sortOrder, that's a separate query — the column is ready.

## Follow-ups

- **PR 2:** build `/admin/products` (the catalog view doesn't exist yet — products are managed at `/guide/dashboard/products`). Add sorting. `/shop` adopts `sortOrder`.
- **PR 3:** build `/admin/events` catalog view + admin-only sort. Public `/events` stays chronological per above.
- **PR 4:** build `/admin/tours` catalog view + admin-only sort. Public `/travels` stays chronological.
