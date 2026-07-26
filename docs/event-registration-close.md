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

## Not changed

- `GET /events/:id` still returns past events. The detail page stays viewable
  (attendees may want to look one up); only registration is closed. If past
  events should 404 outright, that's a separate product call.
- **Sold-out events**: the detail page shows "Sold out" in Availability while
  still rendering the Buy CTA. That path is *safe* — `eventCheckout` rejects on
  remaining capacity, so it fails cleanly — but the CTA is misleading and could
  get the same treatment.
