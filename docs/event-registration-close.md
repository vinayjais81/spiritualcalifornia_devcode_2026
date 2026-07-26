# Past Events — close registration (2026-07-26)

Client-reported: past events could still be registered for.

## Cause

The public events listing (`findPublished`) filters on
`startTime: { gte: new Date() }`, so past events disappear from `/events`.
That was the **only** date check in the events module — and it only affects
which events are *listed*.

Everything downstream was open:

| Path | Past-event guard (before) |
|---|---|
| `GET /events` (listing) | ✅ `startTime >= now` |
| `GET /events/:id` (detail) | ❌ none |
| Event detail page CTA | ❌ none — "Buy Tickets" rendered unconditionally |
| `/events/:id/checkout` page | ❌ none |
| `POST /tickets/event-checkout` | ❌ **none — the purchase actually succeeded** |
| Cart (`cart.service.ts:197`) | ✅ drops tiers whose event has started |

`eventCheckout` validated seeker profile, attendee count, guide visibility,
`isPublished`, `isCancelled`, tier active, and remaining capacity — but never
compared `startTime` to now. The cart had the rule; direct event checkout did
not. So a seeker reaching a past event by direct link, or sitting on the
checkout form until the event began, could complete a real registration.

## Fix

**Server (authoritative)** — `tickets.service.ts` `eventCheckout` now rejects
after the `isCancelled` check:

```ts
if (event.startTime && new Date(event.startTime) < new Date()) {
  throw new BadRequestException('Registration has closed — this event has already started');
}
```

`ticketPurchase.create` appears in exactly one place, so this single guard
covers every purchase path.

**Event detail page** — derives `hasStarted` and swaps the CTA for a disabled
"Registration Closed" chip; the Availability block reads "Registration closed"
instead of contradicting itself with "N spots available".

**Checkout page** — reachable by direct link and can be left open until the
event begins, so it renders a "Registration closed" message rather than a form
the server will reject.

## Rule

**Registration closes at `startTime`**, not `endTime` — matching the rule the
cart already used, so a seeker can't add to cart and check out under different
definitions of "past". An event in progress is closed to new registrations.

## Sold-out and tier-less events (follow-up, same day)

The same CTA problem applied to two more states, so registration entry points
now resolve one of three closed labels instead of rendering a live button:

| State | Label |
|---|---|
| `startTime < now` | Registration Closed |
| no active ticket tiers | Registration Unavailable / "No tickets on sale" |
| all tiers at capacity | Sold Out |

Neither of these was *unsafe* — `eventCheckout` already rejects on remaining
capacity and on a missing/inactive tier — but both advertised a purchase that
could not complete. The tier-less case was the worse of the two: with no tiers,
`ticketTiers.every(...)` is vacuously true, so the CTA read **"Register Free"**
on an event that had nothing to sell.

Gated in three places, because there are two distinct routes into checkout:

- **Events listing** (`/events`) — cards link **straight to `/checkout`**,
  skipping the detail page, so the card CTA needed its own gate. Its
  availability line also claimed "Open to all" for a sold-out virtual event.
- **Event detail** — CTA + Availability block.
- **Checkout page** — reachable by direct link and can be left open while the
  event starts or sells out.

### `findOne` now filters inactive tiers

`findPublished` included `ticketTiers: { where: { isActive: true } }` but
`findOne` included **all** tiers. So the same event exposed different tiers
depending on which page you were on, and an inactive tier's spare capacity
inflated the availability figure the detail page derives — an event could look
available while every purchasable ticket was gone. `findOne` now filters to
active tiers, matching `findPublished`. An inactive tier can't be bought
(`eventCheckout` rejects it), so listing it publicly only advertised a ticket
nobody could get.

## Not changed

- `GET /events/:id` still returns past events. The detail page stays viewable
  (attendees may want to look one up); only registration is closed. If past
  events should 404 outright, that's a separate product call.
