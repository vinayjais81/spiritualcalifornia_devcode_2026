# Abandoned Shop Checkout — Order Stock Holds

Fixes the QA defect *"Abandoning checkout at payment step creates a permanent
orphaned order"* (severity: critical) —
[SpiritualCalifornia-playwright-testing#1](https://github.com/SvetlanaZap/SpiritualCalifornia-playwright-testing/issues/1).

## The defect is worse than the report

The report describes a junk record with no way to cancel it. That's the visible
half. `POST /orders` also does this, inside its create transaction
(`Backend/api/src/modules/orders/orders.service.ts`):

```ts
const res = await tx.product.updateMany({
  where: { id: line.product.id, stockQuantity: { gte: line.quantity } },
  data: { stockQuantity: { decrement: line.quantity } },   // stock leaves the shelf
});
…
await tx.promoCode.update({ where: { id: promoCodeId }, data: { usedCount: { increment: 1 } } });
```

So one click on **Continue to Payment** — before a card is touched — took real
stock off sale and burned a promo redemption, and **nothing ever gave either
back.** A guide with 3 units of a product could have all 3 held by browsers that
closed, with the product reading out-of-stock to every real buyer, permanently.
Every abandoned attempt also consumed one use of a limited promo code.

It compounded per click, too: "Edit details" on the payment step dropped the
order and clicking Continue again created *another* one. Each round trip
reserved another set of units.

The decrement itself is correct — it's what stops two people buying the last
unit — but a reservation with no expiry isn't a reservation, it's a leak.

## The shape of the fix

Keep reserving stock at the payment step; give the reservation a deadline and
three ways to end. This is the same **hold + reaper** pattern `TourBooking`
already uses (`holdExpiresAt` → `releaseExpiredHolds` → stock back +
`CANCELLED`), which is why the new columns and job are named after it.

The alternative the report floats — create the order only after payment
succeeds — was considered and rejected: the PaymentIntent needs an order to
carry in metadata and to verify the charged amount against
(`amountOwedCents`), and with nothing reserved between "Continue" and "paid",
two customers can both pay for the last unit. That trades a stock leak for a
refund-and-apologise problem. The fix is to release holds, not to stop taking
them.

### 1. Orders carry a hold deadline

New on `Order` (migration `20260730120000_order_hold_expiry`):
`holdExpiresAt`, `cancelledAt`, `cancellationReason`, plus a
`(status, holdExpiresAt)` index for the reaper's query.

`ORDER_HOLD_MINUTES` (default **30**) sets the window — long enough to type a
card and clear 3DS, short enough that a scarce product isn't held hostage.
`confirmPayment` clears `holdExpiresAt` when the order goes PAID, so a paid
order is invisible to the reaper.

The migration backfills `holdExpiresAt = createdAt` on existing PENDING orders:
they are abandoned by definition, so the reaper's first run releases the
inventory they've been sitting on. (Safely — see the Stripe check below, which
also protects any historical order that was actually paid without its webhook
landing.)

### 2. One release path, three callers

`OrdersService.releaseOrderHold(orderId, reason, opts)` is the only code that
undoes a hold, so "what does an abandoned order give back" is defined once:
product/variant stock per line, the promo redemption (never below zero), and
the Stripe PaymentIntent — cancelled, so the client secret still sitting in the
customer's browser can't be charged against stock we just released.

Its callers:

| Caller | Trigger |
| --- | --- |
| `cancelMyOrder` → `POST /orders/:id/cancel` | Customer cancels from their dashboard (PENDING + own order only) |
| `supersedePendingOrders` (in `create`) | A new checkout replaces this seeker's earlier attempt |
| `releaseExpiredHolds` → order-tasks reaper | Hold ran out (every 5 minutes) |

Supersede is what stops the multiplication: a seeker can only be paying for one
shop order at a time, so starting a new checkout releases the previous attempt
rather than stacking another hold beside it.

### 3. Never release stock out from under a live charge

This is the part that matters more than the bug being fixed. Refusing to
release is a leak; releasing too eagerly oversells inventory and forces a refund
on a customer who paid. So `releaseOrderHold` asks Stripe first, via
`PaymentsService.releaseUnpaidPaymentIntent`, and **aborts without touching
anything** unless the intent is verifiably not being paid:

| PaymentIntent status | Verdict | Stock |
| --- | --- | --- |
| `requires_payment_method`, `requires_confirmation`, `canceled` | `released` | given back |
| `succeeded`, `requires_capture` | `paid` | untouched — `confirmPayment` finishes the order |
| `processing`, `requires_action` | `in_flight` | untouched — reaper retries later |
| Stripe unreachable / cancel failed | `unknown` | untouched — reaper retries later |

Every uncertain path, including a Stripe outage, leaves the hold in place. The
reaper simply tries again in five minutes.

Two refinements sit on top of that table:

- **Abandoned 3DS.** A customer who opens the 3DS sheet and walks away parks the
  intent in `requires_action` forever, so a strict reading would hold that stock
  for good. The reaper passes `allowRequiresAction` once the hold is a *full
  extra window* overdue, treating the authentication attempt as abandoned too.
- **The race it can't design away.** Stripe can say "not paying" a moment before
  the customer pays. If a charge lands on an order we already released,
  `confirmPayment` reinstates it (PAID, cancellation trail cleared) and
  re-reserves the stock via `reReserveStockForOrder` — deliberately *without* the
  `gte` guard, so a shortfall shows up as negative stock for the guide to
  resolve. The money is captured; the wrong move would be dropping the order or
  shipping inventory we no longer have without saying so. It logs at `error`
  level with the order id.

Concurrency inside the release is handled by claiming the row first:

```ts
const claimed = await tx.order.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED', … } });
if (claimed.count === 0) return 'not-pending';   // someone else got here first
// only the winner restores stock
```

Two reapers, or a reaper racing a customer's click, can't credit the same units
twice.

### 4. The customer can see and end it

- **Checkout** now names the reservation: *"Order created. Complete payment to
  finalise your purchase. Your items are reserved until 3:45 PM."* **Edit
  details** releases the order it just created instead of walking away from it.
- **`/seeker/dashboard/orders`** shows, on every PENDING row, *"Nothing has been
  charged. Items are reserved until … then this order is cancelled
  automatically"*, with a **Cancel order** button (the exit that didn't exist).
  Cancelled rows show their reason. The "Receipt emailed to…" line no longer
  claims a receipt for an unpaid order.

The cancel button lives in the expanded detail, not the summary row — the
summary row is itself a `<button>`, and nesting interactive controls is the bug
from `docs/practitioner-card-nested-controls.md`.

## Deliberately not built

**Resuming an abandoned order.** There's no "complete payment" link on a PENDING
order, because retrieving a live client secret for an existing order isn't an
endpoint we have. Re-adding to the cart and checking out again works, and
supersede cleans up the old attempt. Adding a resume flow is a real improvement,
just a separate one — offering a link that can't work would be worse than not
offering it.

**Hiding PENDING orders from the dashboard.** That would make the QA test fail
by hiding the evidence rather than fixing the cause. The row is real (it holds
stock); it should be visible, labelled, and cancellable.

## Audit: is any other flow holding inventory it can't release?

- **Tour bookings** — already correct. `holdExpiresAt` + `releaseExpiredHolds`
  in the tour-tasks queue (24h hold), which is the pattern this change copies.
- **Event tickets** — no pre-payment reservation to leak. `eventTicketTier.sold`
  is incremented in `confirmEventTickets`, i.e. after payment, so an abandoned
  event checkout leaves a PENDING `TicketPurchase` row but holds nothing. Worth
  a tidy-up pass for the junk rows, not a data-integrity fix.
- **Shop orders** — the one gap, fixed here.

## Verification

- `Backend/api/src/modules/orders/order-hold-release.spec.ts` — 11 tests over
  the release path: stock/promo/PI returned; **no** movement when Stripe says
  paid, in-flight or unknown; no double credit when a concurrent release wins
  the claim; cancel refuses another seeker's order and any paid order; the
  reaper's `allowRequiresAction` escalation and its skip accounting.
- Full backend suite green (93 tests). One existing assertion in
  `confirm-payment-verification.spec.ts` was updated: paying now also clears
  `holdExpiresAt`.
- `tsc --noEmit` clean both sides; `next build` clean.

**The migration is not applied anywhere yet.** The deploy workflow runs
`npx prisma migrate deploy`, so pushing to `origin/main` applies it on QA. The
local dev database is 5 migrations behind (4 of them predating this work), so it
needs `prisma migrate dev` before the shop works locally — flagged rather than
run, since it would apply that backlog too.

## Note for the QA suite

`tests/ui/user/shop.spec.ts` → *"Abandoning checkout at the payment step creates
an orphaned order"* asserts that the order appears and stays. It will **still
pass** immediately after the click, and that's correct now: reaching the payment
step legitimately creates a PENDING order holding stock. What changed is that
the order is no longer permanent or inescapable, so the assertions need to move
to that:

1. The PENDING order carries a `holdExpiresAt` in the future, and the row says
   nothing has been charged.
2. **Cancel order** on `/seeker/dashboard/orders` flips it to Cancelled and the
   product's stock goes back to its pre-checkout value. This is the assertion
   that actually guards the fix — stock, not the row.
3. Clicking **Continue to Payment**, then **Edit details**, then Continue again
   leaves exactly **one** PENDING order for the seeker, not two.
4. Reaper coverage needs a short window to be testable: set
   `ORDER_HOLD_MINUTES=1` on the QA API and assert the order flips to Cancelled
   within ~6 minutes (the reaper runs every 5). If that's too slow for CI, the
   backend unit spec above already covers the reaper's logic directly.

Worth adding as a separate case: a promo-coded checkout that is abandoned and
then cancelled must return the promo's `usedCount`, otherwise a limited code
gets used up by traffic that never paid.
