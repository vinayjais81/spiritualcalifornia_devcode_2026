# Checkout Resume (Server-Persisted Cart + Unified Pending-Actions Panel)

**Shipped:** 2026-04-22 · **Phases delivered:** A + D + D′ · **Phases deferred:** B, C

## Motive

A seeker who abandons checkout on one device should find their cart waiting
intact when they return — even days later, from a different browser. Industry
data (Baymard) shows 70% of carts are abandoned; persistent-cart alone
recovers 8–15% of those.

Beyond the cart, seekers also abandon **soul tour bookings** (deposit not paid
before 24h hold expires), **service bookings** (session picked, payment not
completed), and **event ticket purchases** (payment failed mid-flow). All four
need to surface in one place the moment the seeker lands on the dashboard.

---

## Scope delivered (Phases A + D + D′)

- **Phase A — server-persisted cart.** Every `addItem / updateQuantity /
  removeItem / clearCart` writes through to the server. `GET /cart` returns
  hydrated items with live price/stock/availability and surfaces
  `priceChanged / overstock / unavailable` warnings.
- **Phase D — "Pick up where you left off" widget** on
  `/seeker/dashboard`. Shows item count, subtotal, first 3 thumbnails, and
  a Complete-Checkout CTA whenever the cart is non-empty.
- **Phase D′ — Unified "Needs your attention" panel.** Extends D to cover all
  four abandoned-flow types: cart + pending tours (with deposit hold
  countdown) + pending service bookings + pending ticket purchases. Each row
  type styled distinctly; deadlines under 24h flagged in red. Panel is hidden
  entirely when nothing is pending. (Shipped same day as A+D.)

## Deferred (explicit)

- **Phase B** — persist partial checkout state (event attendee details,
  service booking date/time) on `CartItem.metadata` JSON.
- **Phase C** — abandoned-cart email at T+24h via BullMQ cron.

---

## Locked decisions (reference)

| Decision | Chosen |
|---|---|
| Guest cart support | Yes, via `sessionId` + `x-session-id` header minted client-side on first cart interaction |
| Guest → user merge on login | Union quantities, delete guest cart |
| TTL | Signed-in: indefinite. Guest: 30 days idle. |
| Price change policy | Warn + require explicit Acknowledge before checkout |
| Stock change policy | Warn + block until quantity is lowered to available |
| Deleted/deactivated products | Silently dropped on load, single toast per removal |
| Client state management | Zustand stays source of truth for render. Server wins on conflict (last sync). |
| Sync strategy | Write-through on every mutation, debounced 450ms per item key |
| Failure mode | Network errors are silent; local state keeps working, next mutation or page load reconciles |
| Soul Tours | Untouched — already persisted via `TourBooking.holdExpiresAt` |

---

## Data model

### `CartItem.priceAtAdd` (new column)

`Decimal(10,2) NULL`. Price snapshot at time of add, used by `GET /cart` to
detect "price changed since you added this" without auxiliary history
tables. Nullable for legacy rows that pre-dated this column.

Migration: applied via `prisma db push` (no numbered migration). No
backfill needed — legacy rows are treated as "no snapshot known" which
silences false price-change warnings.

### Pre-existing (unchanged)

- `Cart { id, userId?, sessionId?, createdAt, updatedAt }` — `userId` and
  `sessionId` are both unique. One row per seeker or per guest session.
- `CartItem { id, cartId, itemType, itemId, variantId?, quantity,
  priceAtAdd?, metadata?, ... }` — polymorphic via `itemType` ∈
  `{PRODUCT, EVENT_TICKET, SOUL_TOUR, SERVICE_BOOKING}`.

---

## API surface

All routes mounted under `/cart`. Public (guest-allowed) — identified by
either the JWT user id or the `x-session-id` request header.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/cart` | Hydrated cart. Returns `{ id, items: HydratedCartItem[], itemCount, removedItems }`. Also performs lazy 30-day-idle guest-cart sweep. |
| `POST` | `/cart/items` | Add (or increment if `(type,id,variant)` already present). Body = `AddCartItemDto`. Snapshots `priceAtAdd`. |
| `PUT` | `/cart/items/:itemId` | Update quantity / metadata. |
| `DELETE` | `/cart/items/:itemId` | Remove one item. |
| `DELETE` | `/cart` | Clear entire cart. Auth required. |
| `POST` | `/cart/merge` | Union the guest cart (identified by `x-session-id`) into the authenticated user's cart. Called by frontend right after login. |

### Seeker dashboard aggregation

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/seekers/dashboard/pending-actions` | Returns `{ cart, pendingTours, pendingBookings, pendingTickets }` — all four abandoned-flow buckets in one round-trip. SEEKER role required. Each bucket filters to rows still actionable (not cancelled, not fully paid, hold not expired, event not yet started). |

### `HydratedCartItem` shape

```ts
{
  id, itemType, itemId, variantId, quantity,
  priceAtAdd,           // number | null (snapshot)
  currentPrice,         // number | null (live)
  priceChanged,         // boolean — diff > $0.01
  overstock,            // boolean — quantity > availableStock
  availableStock,       // number | null — null means unlimited/unknown
  metadata,
  details,              // fully-resolved product/event/tour/service record
}
```

### Removal reasons surfaced in `removedItems[]`

- `deleted` — the underlying product/event/tour/service no longer exists.
- `unavailable` — row exists but `isActive = false`, event `isCancelled`,
  event already started, etc.
- `sold_out` — physical product / ticket tier / tour has zero stock.

---

## Frontend architecture

### Session id

`getOrCreateCartSessionId()` in [`lib/api.ts`](../Frontend/web/src/lib/api.ts)
mints a UUID on first call and stores it in `localStorage` under
`sc-cart-session`. The axios request interceptor attaches it as
`x-session-id` on every request. Backend ignores the header outside
`/cart` routes.

### Zustand store — `cart.store.ts`

- Local `items` is the source of truth for rendering (zero-latency UX).
- Every mutation optimistically updates local state, then queues a
  debounced write-through (per-item key, 450ms).
- `syncFromServer()` is called by the Navbar on first client mount and by
  `/cart` / seeker dashboard pages on their own mount — pulls hydrated
  items and warnings.
- `mergeGuestCartIntoUser()` fires from `auth.store.setAuth` right after
  login.
- `warnings` and `warningsAcknowledged` are **not persisted** — they're
  recomputed on every sync.

### Feature flag

`NEXT_PUBLIC_SERVER_CART_ENABLED` (boolean, default `true`). Set to
`"false"` to instantly revert to localStorage-only behavior — every
`syncFromServer / mergeGuestCartIntoUser / write-through` becomes a
no-op. No DB rollback needed.

### UI surfaces

- **Navbar badge** ([`Navbar.tsx`](../Frontend/web/src/components/public/layout/Navbar.tsx)) —
  runs `syncFromServer()` on first mount, reflects the durable count.
- **Cart page** ([`(public)/cart/page.tsx`](../Frontend/web/src/app/(public)/cart/page.tsx)) —
  gold warning banner at top when price changes or overstock detected.
  The **Proceed to Checkout** button is replaced with a disabled
  "Review changes above to continue" placeholder until the user clicks
  **Acknowledge & continue**. Removed-item warnings are toasted once
  each.
- **Seeker dashboard** — unified
  [`NeedsAttentionPanel.tsx`](../Frontend/web/src/components/seeker/NeedsAttentionPanel.tsx)
  above the stats grid. Pulls from `GET /seekers/dashboard/pending-actions`
  and renders one row per in-flight item across four types:
  - 🛍️ **Cart row** — count, subtotal, first 3 thumbs. CTAs: *Complete
    Checkout* (routes to `/checkout/event` if events-only, else
    `/checkout`) + *Review Cart*. Shows a red "Some items changed"
    badge if the cart has price-change or overstock warnings.
  - 🌍 **Pending tour rows** — title, travellers, deposit/total,
    deadline pill ("⏱ Hold expires in 18h", red if <24h). CTAs: *Pay
    Deposit* → `/seeker/dashboard/tours/[id]` + *Tour Details*.
  - 📅 **Pending service-booking rows** — service name, guide, slot
    start + duration, total. CTA: *Complete Payment* →
    `/seeker/dashboard/bookings/[id]`.
  - 🎫 **Pending ticket rows** — collapsed by `purchaseGroupId`; event
    title, qty, tier, total, event start. CTA: *Complete Purchase* →
    `/events/[eventId]/checkout`.

  Panel hides entirely when all four arrays are empty. Header shows a
  gold count badge (total rows).

---

## Deployment

1. `git pull`
2. `cd Backend/api && npm install && npx prisma db push && npx prisma generate && npm run build`
3. Restart API process (e.g. `pm2 restart all`)
4. `cd Frontend/web && npm install && npm run build`
5. Restart Next.js process

**Env var (optional):** set
`NEXT_PUBLIC_SERVER_CART_ENABLED=false` in `Frontend/web/.env.local` to
disable server sync and keep legacy localStorage-only behavior. Default
is enabled.

## Rollback

1. Set `NEXT_PUBLIC_SERVER_CART_ENABLED=false` → rebuild frontend →
   restart.
2. Client stops talking to `/cart` endpoints immediately. Backend data
   untouched.
3. No DB rollback needed — the `priceAtAdd` column is nullable and
   additive; it doesn't break the old code path if it ever gets
   re-deployed.

---

## Smoke test for Phase D′ (Needs Attention panel)

1. **Pending tour:** As a seeker, start booking a tour but stop at the deposit
   step. Go to `/seeker/dashboard` → row appears under Needs your attention
   with the tour cover, traveller count, deposit amount, and a countdown
   ("⏱ Hold expires in Nh"). Clicking **Pay Deposit** lands on the tour
   booking detail page.
2. **Red deadline:** Manually set the `TourBooking.holdExpiresAt` to
   `now + 2h`. Reload dashboard → deadline pill renders red.
3. **Pending service booking:** Start a service booking without completing
   payment. Row appears with guide name, slot datetime, total. **Complete
   Payment** CTA routes to booking detail.
4. **Pending ticket:** Force a `TicketPurchase` row to `status: PENDING`
   (payment failure simulation). Row appears collapsed by purchase group,
   showing quantity + event start.
5. **Hidden when empty:** All pending flows resolved → panel disappears
   from dashboard entirely.
6. **Guest:** Log out, add items to cart → panel still shows just the cart
   row; tour/booking/ticket buckets are empty (correctly — guest can't own
   them).

## Smoke test (7 checks)

1. **Guest persist:** Log out. Add 2 products. Navbar badge = 2.
2. **Login merge:** Sign up or log in. Cart still shows 2 items. Open a
   second browser (same account). Items present there too.
3. **Dashboard widget:** Go to `/seeker/dashboard`. "Pick up where you
   left off" card visible above stats with correct count + subtotal.
4. **Price change:** Raise a product's price in the guide dashboard.
   Reload `/cart`. Gold warning banner shows old → new. Proceed to
   Checkout replaced with "Review changes above to continue" until
   Acknowledge clicked.
5. **Deactivated product:** Guide deactivates another product in cart.
   Reload `/cart` → toast "X is no longer available and was removed".
   Cart shrinks.
6. **Network failure:** DevTools → offline. Quantity +/− still works
   locally. Go back online → next action reconciles with server.
7. **Guest TTL:** (manual) Set a guest cart's `updatedAt` to 31 days
   ago in the DB → make any cart request → confirm it's deleted.
