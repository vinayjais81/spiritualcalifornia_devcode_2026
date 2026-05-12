# Reviews v2 — Polymorphic across Service / Event / Tour / Product

**Status:** Shipped 2026-05-12. Single PR. No feature flag — replaces v1 in place
because the data model is a strict superset (additive migration with backfill).

## Why

v1 only supported reviews of **services** (one review per `Booking`). The
platform also sells **events**, **tours**, and **products** — none of which were
reviewable. This change generalizes the existing model so every kind of
purchase a seeker makes is reviewable, and the per-offering rating shows up on
the corresponding detail page. The guide's overall `averageRating` still
rolls up across their whole catalogue.

## Data model

```
Review {
  id              cuid
  authorId        → User             // seeker
  guideId         → User             // guide whose offering was reviewed
                                     // (renamed from v1 `targetId` — same column,
                                     // existing data unchanged)
  targetType      ReviewTarget       // SERVICE | EVENT | TOUR | PRODUCT
  targetEntityId  String             // Service.id | Event.id | SoulTour.id | Product.id
  bookingId        → Booking?        @unique  // exactly one of these four is set
  ticketPurchaseId → TicketPurchase? @unique
  tourBookingId    → TourBooking?    @unique
  orderItemId      → OrderItem?      @unique
  rating          Int 1..5
  title           String?
  body            String?
  guideReply      String?            // forward-compat, not yet exposed
  guideRepliedAt  DateTime?
  isApproved      Boolean @default(true)   // Auto-publish; admin can flag/hide
  isFlagged       Boolean @default(false)
}
```

**Per-entity aggregates** added to `Service`, `Event`, `SoulTour`, `Product`:
`averageRating: Float`, `reviewCount: Int`. Backfilled from existing reviews
for services in the same migration.

**Guide-level roll-up** stays on `GuideProfile` (`averageRating`,
`totalReviews`) and aggregates across all the guide's offerings.

## Verified-purchase rules (eligibility)

| Target  | Eligible when                                                                  |
| ------- | ------------------------------------------------------------------------------ |
| SERVICE | `Booking.status = COMPLETED`                                                   |
| EVENT   | `TicketPurchase.status = CONFIRMED` **and** `event.endTime` is in the past    |
| TOUR    | `TourBooking.status = COMPLETED`                                               |
| PRODUCT | `OrderItem.deliveredAt` is set (digital = at PAID, physical = at delivery)    |

Per-source unique indexes (`bookingId_key`, `ticketPurchaseId_key`,
`tourBookingId_key`, `orderItemId_key`) prevent the same purchase from being
reviewed twice.

## Moderation

Auto-publish (`isApproved` defaults `true`). Admins have two reactive levers:

- `PATCH /reviews/:id/flag`     — toggle `isFlagged`. Public listings hide
  flagged reviews; the guide dashboard still shows them with a "Flagged" pill.
- `PATCH /reviews/:id/moderate` — toggle `isApproved`. Hides from public
  listings.

Both recompute the entity + guide aggregates inside the transaction.

## Endpoints

| Method | Path                                                            | Who      | Purpose                                              |
| ------ | --------------------------------------------------------------- | -------- | ---------------------------------------------------- |
| POST   | `/reviews`                                                      | SEEKER   | Create review for any verified purchase              |
| GET    | `/reviews/eligibility?targetType=…&transactionId=…`             | SEEKER   | Check whether a purchase is reviewable               |
| GET    | `/reviews/eligibility/:bookingId`                               | SEEKER   | **Legacy** alias → SERVICE eligibility for a booking |
| GET    | `/reviews/reviewable`                                           | SEEKER   | All pending purchases, grouped by type               |
| GET    | `/reviews/mine`                                                 | SEEKER   | Reviews this seeker has submitted                    |
| GET    | `/reviews/for?targetType=…&targetEntityId=…&page&limit`         | PUBLIC   | Paginated reviews for a single offering              |
| GET    | `/reviews/guide/:userId?page&limit`                             | PUBLIC   | Cross-offering reviews for a guide                   |
| GET    | `/reviews/received?targetType=…`                                | GUIDE    | Reviews the current guide has received               |
| GET    | `/reviews/testimonials/:guideId`                                | PUBLIC   | Approved guide-managed testimonials (unchanged)      |
| PATCH  | `/reviews/:id/flag` &nbsp; `/reviews/:id/moderate`              | ADMIN    | Reactive moderation                                  |

## Review-prompt email

Reuses the existing `EmailService.sendReviewRequest` (now polymorphic) and
`NotificationsService.notifyReviewRequest` (also polymorphic). Triggered
synchronously (fire-and-forget) at each state transition that makes a
purchase reviewable:

- **SERVICE**: `BookingsService.complete()` — guide marks the session done.
- **PRODUCT** (digital): inside `PaymentsService.writeLedgerForCharge()` when
  the order is PAID and digital items get their `deliveredAt` stamp.
- **PRODUCT** (physical): inside `PaymentsService.markOrderDelivered()` for
  each item whose `deliveredAt` was just set.
- **EVENT / TOUR**: no automated email yet — surfaced via the seeker
  dashboard's `PendingReviewsWidget`. Adding a cron sweep
  (`event.endTime < now()` for tickets, `TourBooking.status → COMPLETED` for
  tours) is the natural follow-up.

## Frontend surfaces

- **Submission form** — `/reviews/new?targetType=…&transactionId=…`. The old
  `/reviews/new/[bookingId]` route is a redirect for legacy email links.
- **`<ReviewsBlock targetType targetEntityId />`** — drop-in for any detail
  page. Renders avg, distribution bars, paginated list, and an empty state.
  Wired into:
  - `events/[id]/page.tsx`
  - `tours/[slug]/page.tsx`
  - `shop/[id]/page.tsx` (replaces old `<ReviewsSection>` which used a
    bespoke `/products/:id/reviews` endpoint — still in the page's local state
    only for the compact rating pill, retire when convenient).
- **`<PendingReviewsWidget />`** — added to `/seeker/dashboard`. Hides itself
  when nothing is pending.
- **Guide dashboard reviews page** (`/guide/dashboard/reviews`) — gains
  filter tabs (All / Services / Events / Tours / Products) backed by
  `GET /reviews/received?targetType=`.

## Aggregate-recompute discipline

`reviewsService.recomputeAggregates(targetType, targetEntityId, guideUserId)`
is the single source of truth and runs inside a `prisma.$transaction` on:

1. Create (after the row inserts).
2. Flag toggle (in `flagReview`).
3. Moderation toggle (in `moderateReview`).

Per-entity aggregate filters `isApproved=true AND isFlagged=false`, so
flagging a review immediately drops both the entity and the guide rollup.

## Migration: `20260512150000_reviews_v2_polymorphic`

1. Create `ReviewTarget` enum.
2. Drop old `reviews_targetId_fkey` + `reviews_targetId_isApproved_idx`.
3. Rename `targetId` → `guideId` (column-rename; existing values already
   pointed at a guide `User.id`, so no data move).
4. Add `targetType`, `targetEntityId`, three new nullable source-FK columns,
   `guideReply`, `guideRepliedAt`.
5. Backfill: every existing row gets `targetType='SERVICE'` and
   `targetEntityId = bookings.serviceId` joined via `bookingId`.
6. Promote `targetType` + `targetEntityId` to `NOT NULL`; drop `NOT NULL` on
   `bookingId` (one of the four FKs now identifies the source).
7. Re-add FKs (`SET NULL` on parent delete to preserve history) +
   per-source unique indexes + the two new read-path indexes
   (`(guideId, isApproved)` and `(targetType, targetEntityId, isApproved)`).
8. Add `averageRating` + `reviewCount` to Service / Event / SoulTour /
   Product, then backfill the Service aggregates from the existing reviews.

## What's intentionally out of scope

- Photo reviews
- Helpful / unhelpful voting
- Multi-axis ratings (value / hospitality / etc.)
- Guide replies UI (schema field added, no UI yet)
- Testimonials creation UI (model exists, still no CRUD)
- Auto-prompt emails for EVENT and TOUR (would need a cron sweep)
- Per-service reviews on the service-booking page
  (`/book/[guideSlug]` keeps guide-level rating only)
