# Inline `@Body()` Validation Sweep

Converts every remaining unvalidated request body in the API to a DTO class.

Follow-up to [seeker-profile-field-limits.md](seeker-profile-field-limits.md),
which found the pattern while fixing the seeker Bio/Interests defect.

## The pattern

Nest's global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`, set in
`Backend/api/src/main.ts`) only runs when the `@Body()` parameter's **metatype
is a class**. Three declarations look validated and are not:

```ts
@Body() dto: { bio?: string }              // inline type literal → erases to Object
@Body('amount') amount: number             // primitive metatype → skipped
@Body() data: any                          // no metatype at all
```

In every case the pipe silently passes the body straight through: no length
checks, no type checks, no unknown-key rejection. TypeScript reports the code
as typed, so it survives review — the endpoint works, accepts anything, and
never errors. It surfaces only as a QA finding or an incident.

Worse, several of these bodies were spread directly into Prisma, so unknown
keys became writable columns.

## What changed

18 endpoints across 11 modules. New DTOs, all with class-validator decorators;
services now take the DTO type.

| Module | Endpoint | Was | Now |
| --- | --- | --- | --- |
| ai | `POST /ai/chat` | inline | `ChatDto` — message ≤2000, history ≤20 × ≤4000, role enum |
| ai | `POST /ai/product-finder` | inline | `AiQueryDto` — query ≤500, non-empty |
| ai | `POST /ai/practitioner-match` | inline | `AiQueryDto` |
| payments | `POST /payments/create-intent` | inline | `CreatePaymentIntentDto` — amount numeric, $0.50–$100k, id fields ≤64, paymentType enum |
| payments | `POST /payments/confirm-payment` | inline | `ConfirmPaymentDto` |
| payments | `POST /payments/payout` | `@Body('amount')` | `RequestPayoutDto` — ≥ $1 |
| payments | `POST /payments/:id/refund` | `@Body('amount')` | `RefundPaymentDto` — optional, > 0 |
| payments | `POST /payments/subscription/checkout` | `@Body('plan')` | `SubscriptionCheckoutDto` — optional enum |
| auth | `POST /auth/change-password` | inline | `ChangePasswordDto` |
| verification | `POST /verification/guides/:id/approve` | inline | `ReviewNotesDto` — notes ≤1000 |
| verification | `POST /verification/guides/:id/reject` | inline | `ReviewNotesDto` |
| contact | `PATCH /contact/leads/:id/status` | inline | `UpdateLeadStatusDto` — enum of 3 |
| seekers | `PATCH /seekers/onboarding/step` | inline | `UpdateOnboardingStepDto` — int 1–10 |
| soul-tours | `POST /soul-tours/:id/itinerary` | inline | `ReplaceItineraryDto` — nested, ≤365 days |
| admin | `PATCH /admin/products/:id/active` | inline | `SetActiveDto` |
| admin | `PATCH /admin/events/:id/published` | inline | `SetPublishedDto` |
| admin | `PATCH /admin/tours/:id/published` | inline | `SetPublishedDto` |
| admin | `PATCH /admin/guides/:id/featured` | inline | `SetFeaturedDto` |
| reviews | `PATCH /reviews/:id/flag` | `@Body('flag')` | `FlagReviewDto` |
| reviews | `PATCH /reviews/:id/moderate` | `@Body('approved')` | `ModerateReviewDto` |
| bookings | `PATCH /bookings/:id/cancel` | `@Body('reason')` | `CancelBookingReasonDto` — ≤500 |
| checkout | `POST /checkout/summary` | `any` | `OrderSummaryDto` — nested items, qty 1–999 |

### Worth calling out

**The `/ai/*` routes were the sharpest edge.** All three are `@Public()` and
every request bills a Claude call. An unbounded `message` and an unbounded
`history` array were an uncapped spend and context-window vector from
unauthenticated callers. `@AIThrottle()` caps request *rate*, not request
*size*.

**`ReplaceItineraryDto` looked validated but wasn't.** The route was declared
`@Body() body: { days: CreateItineraryDayDto[] }` — it names a decorated DTO,
so it reads as safe. The *parameter* metatype is still a plain object literal,
so `CreateItineraryDayDto`'s decorators never ran. Nested validation requires
the top-level body to be a class carrying `@ValidateNested()`.

**Boolean toggles failed quietly.** With no `@IsBoolean`, a body of `{}` sent
`undefined` to Prisma, which treats it as "skip this column". The request 200'd
having changed nothing — a success toast on a row that didn't move.

## Deliberately unchanged

**`POST /calendly/webhook` keeps `@Body() body: any`.** The payload is
Calendly's, its shape is theirs to change, and authenticity comes from the
signature header verified in `handleWebhookEvent`. A DTO would reject
unrecognised fields and drop events we should process. The controller now says
so in a comment.

**`ChangePasswordDto` is not decorated with `@IsStrongPassword`,** unlike
`RegisterDto`/`ClaimAccountDto`. `AuthService.changePassword` already runs
`checkPasswordPolicy` plus `assertPasswordNotPersonal` (which needs the user's
name/email, unknown at DTO level) and returns one joined message. Adding the
decorator would fire first and hand the settings page a differently-shaped
error for the same failure.

## A trap worth remembering: `maxDecimalPlaces` on money

The first draft of `CreatePaymentIntentDto` used
`@IsNumber({ maxDecimalPlaces: 2 })` on `amount`. It looks obviously correct
for currency. It would have 400'd real checkouts.

Cart totals are the sum of floats, and IEEE-754 leaks precision:

```
79.99 + 6.60  = 86.58999999999999
19.99 + 1.65  = 21.639999999999997
```

Roughly half of sampled realistic subtotal+tax pairs violate a 2dp constraint.
The DTOs use plain `@IsNumber()` with `@Min`/`@Max`; `StripeService` already
does `Math.round(amount * 100)` before charging. `inline-body-validation.spec.ts`
has a regression guard so this isn't "tidied up" later.

## Known gap — not fixed here

`CreatePaymentIntentDto` validates the **shape** of `amount`, not its
**correctness**. The client still asserts the figure and the server does not
recompute it from the referenced booking/order. Bounding a value is not the
same as trusting it: a caller can still request an intent for less than the
item costs. Closing that means deriving the amount server-side from
`bookingId`/`orderId`/`ticketPurchaseId`/`tourBookingId` and ignoring the
client's number — a behavioural change with its own testing needs, out of
scope for a validation sweep.

## Tests

`Backend/api/src/common/inline-body-validation.spec.ts` — 17 cases covering
every DTO above: accepted happy paths, the specific junk each endpoint used to
swallow, the float-artifact regression guard, and empty-body rejection for the
boolean toggles.

## Guard for next time

Any `@Body()` that isn't a DTO class is an unvalidated endpoint, whatever its
TypeScript annotation says. Find regressions with:

```bash
rg -U "@Body\(\)\s*\w+\s*:\s*\{|@Body\('[^']+'\)|@Body\(\)\s*\w+\s*:\s*any" Backend/api/src
```

Every accepted property needs at least one validation decorator, or
`forbidNonWhitelisted` rejects the whole body — `@ApiProperty` alone is
doc-only and does not count.
