# Editing an event's ticket price

Production report, 2026-09-02: *"Not able to change the price of the event —
create an event, go to the dashboard, click Edit, there is no option to see or
change the price."*

Accurate, and the missing field was the smallest part of it. **The price could
not be changed by any route** — not through the UI, and not by calling the API
directly either.

## Why it was invisible in three places at once

The price is not a column on `Event`. It lives on `EventTicketTier`, and the
dashboard creates exactly one tier per event, named *General Admission*. That
split is what let the gap open, because every layer handled the tier only on
create:

| Layer | State before |
| --- | --- |
| `guide/dashboard/events/page.tsx` | The price input was wrapped in `{!editingId && …}`, so it rendered on create and vanished on edit |
| The same file's `save()` | The `PUT` body never included `ticketPrice`, even though `openEdit` had already loaded it into form state |
| `UpdateEventDto` | Had no `ticketPrice` field at all |
| `EventsService.update()` | Never touched `eventTicketTier` — only `create()` did |

The DTO gap is the one that matters most for triage: the API runs
`ValidationPipe` with `whitelist` **and** `forbidNonWhitelisted`, so a client
that sent `ticketPrice` on `PUT /events/:id` got a **400 — "property ticketPrice
should not exist"**. Unhiding the input alone would have turned a silent failure
into a loud one, nothing more.

This is the same defect class as the tour room prices fixed in `c634892` — a
child-table price that the update path silently ignored. Worth checking the
remaining nested-price editors against this pattern.

## The trap in fixing it: the payments gate reads stale state

`update()` already gated paid+published events on Stripe Connect:

```ts
if (finalPublished && (await this.eventIsPaid(eventId))) { … }
```

`eventIsPaid` queries the tiers **on disk** — the state *before* this update. That
was harmless while the price was immutable. The moment the price became editable
it turned into a bypass: taking a free published event to $50 would be waved
through, because the gate looked at the `$0` that had not been overwritten yet.

The gate now judges the state the update *results in*, folding in the incoming
price and any other active tiers:

```ts
const finalIsPaid = dto.ticketPrice !== undefined
  ? dto.ticketPrice > 0 || activeTiers.slice(1).some(t => Number(t.price) > 0)
  : activeTiers.some(t => Number(t.price) > 0);
```

The event row and the tier row are then written in **one `$transaction`**, so a
partial write cannot leave a published event paid after the gate cleared it as
free.

## Other decisions

- **A missing tier is created, not ignored.** Events made before the price field
  existed — or created with no price — have no tier to update, so the edit would
  have gone nowhere. `update()` now mints the same *General Admission* tier
  `create()` would have, capacity 100.
- **Only the oldest active tier is touched.** The dashboard is single-tier, so
  that is the one its price field maps to. Any additional tiers are left alone
  but still count toward "is this event paid".
- **Repricing with tickets sold is allowed, and logged.** `TicketPurchase`
  stores its own `totalAmount`, so past buyers keep what they paid; a change is
  a pricing decision, not a data problem. The form says so — *"N tickets already
  sold. Changing the price only affects new purchases."* — and the server logs
  the old → new price with the sold count, so nobody has to guess later why two
  attendees paid different amounts.
- **`0` had to survive the client.** `form.ticketPrice || undefined` would drop a
  deliberate zero and make a paid event impossible to turn free again, so the
  client tests for an empty string. A half-typed number (`-`, `1e`) is `NaN`,
  which `JSON.stringify` turns into `null` and the API rejects as "must be a
  number" — so `save()` refuses it with a toast first.

## Verification

`src/modules/events/event-price-update.spec.ts` — 12 tests, the same shape as
`room-type-sync.spec.ts`. Beyond the reported defect they pin the gate
behaviour, which is the part that would fail silently and expensively: free →
paid is blocked without Connect, a stays-free edit never consults the gate, a
draft is never gated whatever the price, publishing and repricing in one call is
still gated, and a second paid tier keeps the event paid even when the first is
zeroed.

Full backend suite 208/208, `tsc` clean on both packages, `next build` clean.
