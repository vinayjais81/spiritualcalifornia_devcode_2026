# Public Visibility Gate — Unified Guide Gate Across Offerings

## Problem

A guide's **public profile** is gated on three flags that must ALL hold:

```
isVerified  AND  isPublished  AND  user.isActive
```

But each offering type (services, events, tours, tickets, products, blog) shipped
its own public query with a *different, looser* subset of that gate — most only
checked `user.isActive`, some checked nothing at all. The result: a guide who was
unverified, unpublished, or reverted to draft could have their **profile 404**
while their **tours, products, events, and services stayed publicly reachable and
purchasable** via direct URL, home carousels, and search.

Concrete report that surfaced this: guide `vinay-jaiswal`'s profile 404'd, yet his
tour `/tours/new-tour-to-nepal-...` and product `/shop/...` were still live.

## Fix

Single source of truth: `Backend/api/src/common/public-visibility.ts`

```ts
export const PUBLIC_GUIDE_WHERE = {
  isVerified: true,
  isPublished: true,
  user: { isActive: true },
} satisfies Prisma.GuideProfileWhereInput;
```

Spread into the `guide` relation of every public **read** query, and into every
**purchase** query that resolves an offering by id, so an offering can never
outlive its owning guide's visibility. The guide-profile gate itself
(`guides.service.ts getPublicProfile`) was already correct and is unchanged.

### Read surfaces gated

| File | Method(s) | Was | Now |
|------|-----------|-----|-----|
| `soul-tours/soul-tours.service.ts` | `findOne`, `findPublished`, `getPublicStats` | `guide.user.isActive` | `PUBLIC_GUIDE_WHERE` |
| `products/products.service.ts` | `findPublic`, `findOne` | `guide.user.isActive` (findOne had no `isActive`) | `PUBLIC_GUIDE_WHERE` (+ `isActive` on findOne) |
| `services/services.service.ts` | `findOne` | **ungated `findUnique`** | `findFirst` + `isActive` + `PUBLIC_GUIDE_WHERE` |
| `events/events.service.ts` | `findPublished`, `findOne` | `guide.user.isActive` | `PUBLIC_GUIDE_WHERE` (+ `isPublished` on findOne) |
| `home/home.service.ts` | blog, products, events, tours | `guide.user.isActive` | `PUBLIC_GUIDE_WHERE` |
| `search/postgres-search.service.ts` | products, events, tours, blog (raw SQL) | `u.isActive` only | `+ g.isVerified + g.isPublished` |
| `search/search.service.ts` | Algolia reindex guides/products/events (dormant) | subset | `PUBLIC_GUIDE_WHERE` |

Note: the live search path is the raw SQL in `postgres-search.service.ts`
(trigger-maintained tsvectors). Its **guide** search was already fully gated; only
the offering searches leaked. The Algolia reindex in `search.service.ts` is dormant
(`ALGOLIA_ENABLED=false`) but was fixed for parity.

### Purchase surfaces gated (defense-in-depth)

Direct-id purchase flows could bypass the read gate entirely, so they now resolve
the offering through the same gate:

| File | Method | Effect |
|------|--------|--------|
| `tickets/tickets.service.ts` | `eventCheckout` | can't buy tickets for an invisible guide's event |
| `soul-tours/soul-tours.service.ts` | `bookTour` | can't book a draft tour or one from an invisible guide |
| `orders/orders.service.ts` | `create` | can't order a product from an invisible guide (was `isActive` only) |
| `bookings/bookings.service.ts` | `create`, `createServiceBooking` | can't book a service from an invisible guide (was `isActive` only) |

## Not changed (intentionally)

- **Guide-owned dashboards** (`/events/mine`, `/products/mine`, `/services/mine`,
  tour/`mine`): guides manage their own drafts here and edit inline, so gating the
  public `findOne` does not affect them.
- **Profile-embedded lists** inside `getPublicProfile`: the parent profile is
  already gated, so if it renders the guide is visible and their published
  offerings should show.
- **`checkout.calculateOrderSummary`**: display-only price calculator; the
  authoritative gate lives at `orders.create`.

## Invariant

> An offering (service, event, tour, ticket, product, blog post) is publicly
> visible or purchasable **iff** its guide satisfies `PUBLIC_GUIDE_WHERE`
> (`isVerified && isPublished && user.isActive`) AND the offering's own
> publish/active flag is set.

When adding a new public read or a new purchase entry point for any guide-owned
entity, spread `PUBLIC_GUIDE_WHERE` into the `guide` relation. Do not re-derive the
subset by hand.
