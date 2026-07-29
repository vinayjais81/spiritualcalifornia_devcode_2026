# Checkout Account Gate — No Guest Checkout

**Status:** Implemented
**Decision date:** 2026-07-08 (client-approved) · **Hardened:** 2026-07-29
**Applies to:** Shop checkout, Event checkout, Tour booking, Service booking

---

## 1. The policy

**Spiritual California has no guest checkout, on any surface, by design.**

A buyer must be signed in with a `SEEKER` account before they can submit any
purchase. This is not a gap waiting to be filled — it is a deliberate product
decision, and the data model enforces it.

### Why the platform is account-centric

| Purchase type | Why an account is required |
|---|---|
| Digital products | Checkout promises *"lifetime re-download"* from the `/downloads` library. A guest has no library — guest digital orders would be orphaned 7-day email links plus a permanent support burden. |
| Physical products | Order history, tracking emails, returns within the 30-day window. |
| Event tickets | QR e-tickets, door check-in, re-sending a lost ticket, refunds. |
| Soul tours | CST seller-of-travel compliance, `BookingConsent` records, deposits with balance payments months later. Anonymous buyers are a compliance liability. |
| Reviews | Reviews are verified-purchase-only, so a guest purchase could never produce one — starving the trust signal that is the platform's differentiator. |

### Why it is architecturally enforced

Guest checkout is not merely "not built" — it is currently **impossible** to
submit one:

- **Data layer.** `Order.seekerId`, `Booking.seekerId` and `TourBooking.seekerId`
  are all **non-nullable** `String` relations to `SeekerProfile`.
- **API layer.** `POST /orders`, `POST /tickets/event-checkout`,
  `POST /soul-tours/book` and `POST /bookings` are all guarded by
  `JwtAuthGuard + RolesGuard` with `@Roles(SEEKER)`.
- The only `@Public()` checkout endpoints are read-only helpers:
  `GET /checkout/shipping-methods`, `GET /checkout/tax-rates`,
  `POST /checkout/validate-promo`.

The **cart** is the one genuinely guest-capable surface: guests build a cart
against a `x-session-id`, and `mergeGuestCartIntoUser()` unions it into the
server cart on sign-in (`auth.store.ts` → `setAuth`).

---

## 2. The bug this fixes

> *"On the Shop checkout, filling in the full guest contact form (email,
> first/last name) and clicking 'Continue to Payment' silently redirects to the
> Sign In page discarding everything just typed, with no message explaining that
> an account is required."* — client report

The root cause was never a checkout bug. It was a **product gap surfaced as a
UI lie**: the page invited guest data entry into a form the backend could never
accept, and the failure mode was a silent redirect.

There were **three distinct paths** to that symptom. The July fix closed only
the first.

### Path 1 — signed-out visitor on Shop checkout *(fixed 2026-07-08, `cd07a07`)*
The form rendered for guests; `POST /orders` 401'd; the api.ts interceptor
assumed an expired session and hard-navigated to `/signin`, discarding the form.

### Path 2 — signed-out visitor on Event checkout *(fixed 2026-07-29)*
`/events/[id]/checkout` had **no gate at all**. A guest could select tickets,
fill first name / last name / email **for every attendee**, click
"Continue → Payment", and get `router.push('/signin?…')` with no toast and no
state saved. This is the same defect, on the page the July fix never touched.

### Path 3 — session expiry mid-form, any page *(fixed 2026-07-29)*
The subtlest one, and the one most likely behind a report that says
"Shop checkout" even after Path 1 was fixed. If a signed-in buyer's refresh
token died while the form was open:

1. the auth store still reported `isAuthenticated: true`,
2. so **both** the page gate and the defensive submit guard passed,
3. `POST /orders` 401'd, the refresh failed,
4. and `api.ts` set `window.location.href = '/signin'` — **bare**: no
   `?redirect=`, no explanation, form gone.

A tester who had signed in earlier in the session would hit exactly this, on
the Shop checkout, with the button labelled "Continue to Payment".

---

## 3. What was implemented

### 3.1 Shared gate component — `components/public/checkout/CheckoutAccountGate.tsx`

Single source of truth for the panel and the auth check, so the wording, CTAs
and `?redirect=` round-trip stay identical everywhere.

```tsx
export function useCheckoutAccountGate(): boolean   // hasHydrated && !isAuthenticated
export function CheckoutAccountGate({ redirect, body, backHref?, backLabel? })
```

**`_hasHydrated` is load-bearing.** On first paint zustand has not yet read
persisted state from localStorage, so `isAuthenticated` is still its `false`
default. Gating on hydration is what stops a signed-in seeker seeing a flash of
the sign-in wall. Never drop it.

Used by:

| Page | `redirect` | Placement |
|---|---|---|
| `(public)/checkout/page.tsx` | `/checkout` | After the empty-cart check |
| `(public)/events/[id]/checkout/page.tsx` | `/events/{id}/checkout` | **After** the sold-out / registration-closed checks |
| `(public)/checkout/event/page.tsx` | `/checkout/event` | Before the attendee form |

> The event-checkout gate deliberately sits *after* the sold-out and
> registration-closed checks. There is no point sending someone to sign in for
> a purchase that cannot be completed anyway.

### 3.2 Draft persistence — `lib/checkoutDraft.ts`

`sessionStorage`-backed helpers (`saveCheckoutDraft` / `loadCheckoutDraft` /
`clearCheckoutDraft`) under the `sc-checkout-draft:` prefix, so an auth detour
or a mid-form session expiry can no longer destroy typed input.

- **sessionStorage, not localStorage** — a draft can hold a name, email and
  postal address; it should not outlive the browsing session or hit disk
  indefinitely.
- **Best-effort** — every helper no-ops on the server and swallows storage
  errors (Safari private mode throws on write). A draft is a nicety, never a
  reason to break checkout.
- **Cleared on success** — both checkouts call `clearCheckoutDraft()` as soon
  as payment confirms, so contact details do not linger.

| Page | Key | Persisted |
|---|---|---|
| Shop | `shop` | contact form, shipping method, applied promo |
| Event | `event:{eventId}` | step, tier, quantity, attendees |

Two rules encoded in the effects:

- **Never restore into Payment or Confirmation.** Those steps are backed by a
  Stripe client secret that is deliberately *not* persisted, so `step >= 2` is
  never saved and only `step === 1` is restored.
- **Validate before restoring.** A restored ticket tier is only applied if that
  tier is still present and `isActive` on the freshly-loaded event.

### 3.3 Session-expiry redirect — `lib/api.ts`

`buildSessionExpiredUrl()` replaces the bare `/signin` navigation. It now
always carries:

- `redirect` — the page the user was on, so sign-in returns them there
  (`/onboarding/*` still collapses to `/onboarding/guide`, which resumes from
  server-side status), and
- `reason=session-expired` — which `app/signin/page.tsx` renders as a visible
  notice: *"Your session timed out, so please sign in again — we'll take you
  straight back to where you left off."*

Auth routes (`/signin`, `/register`, `/forgot-password`, `/reset-password`) are
excluded from `redirect` so the URL cannot loop on itself.

**This fix is global, not checkout-specific** — the bare redirect could strike
any authenticated page.

### 3.4 Cart-level notice — `(public)/cart/page.tsx`

A signed-out visitor now sees, next to *Proceed to Checkout*:

> 🔒 You'll need an account to check out — it keeps your receipts, downloads and
> tickets in one place. Your cart is saved.

This is the cheapest and most important part of the fix, and it is the client's
own suggestion: state the requirement **before** the buyer opens any form,
rather than after they have filled one in.

---

## 4. The convention

**Any page that requires auth to submit must say so before rendering the form,
not after.**

1. Render a gate when `useCheckoutAccountGate()` is true — never invite input
   that cannot be submitted.
2. Keep a defensive guard at the submit handler anyway, for sessions that
   expire while the form is open. It must `toast` **and** save a draft before
   redirecting — never a silent `router.push`.
3. Always send `?redirect=` so the user lands back where they were.
4. Never navigate to a bare `/signin`.

`(public)/tours/[slug]/book/page.tsx` and `(public)/book/[guideSlug]/page.tsx`
already followed the toast + `saveFormState()` half of this convention and were
the model for it. They gate at submit rather than before the form — acceptable
because they lose no data, but they still invite guest entry (the tours page
even shows a *"Sign in to pre-fill your details"* tip). Worth aligning if the
client raises it.

---

## 5. Known gaps

- **`/checkout/event` is a non-functional stub.** `PaymentForm` is a mock,
  there is no API call, and submitting runs `clearCart(); setDone(true)` — so it
  displays *"Your Tickets Are Confirmed!"* **without ever charging or issuing a
  ticket.** The gate keeps signed-out visitors out of it, but the page must be
  finished or removed. The real, wired-up flow is `/events/[id]/checkout`.
  See `static-to-dynamic-audit.md`.
- **No abandonment instrumentation.** Gate impressions vs. sign-in completions
  are not tracked, so the accelerated-account decision below has no data behind
  it yet.

---

## 6. Deferred: "accelerated account"

If the sign-in wall proves costly, the agreed next step is **not** true guest
checkout.

**Accelerated account (email-first).** The buyer enters email + first/last name
— *fields the checkout form already collects* — an account is auto-provisioned
at order time, and a "set your password" email follows the purchase. It feels
like guest checkout, preserves the Downloads library, and requires **no schema
migration**, because `seekerId` stays non-nullable.

**Rejected: true guest checkout.** Needs a nullable-`seekerId` migration, a
guest identity concept, tokenised email-only download auth, an order-claim
flow, and guest refund handling — and fights the account-centric model at every
turn.

Revisit only with real abandonment numbers, and note that the loss concentrates
on low-consideration physical merch; the rest of the catalogue is high-intent
and high-ticket, where a sign-in wall costs little.

---

## 7. Files touched

**Added**
- `Frontend/web/src/components/public/checkout/CheckoutAccountGate.tsx`
- `Frontend/web/src/lib/checkoutDraft.ts`

**Modified**
- `Frontend/web/src/lib/api.ts` — `buildSessionExpiredUrl()`
- `Frontend/web/src/app/signin/page.tsx` — `reason=session-expired` notice
- `Frontend/web/src/app/(public)/checkout/page.tsx` — shared gate + draft
- `Frontend/web/src/app/(public)/events/[id]/checkout/page.tsx` — **gate added** + draft
- `Frontend/web/src/app/(public)/checkout/event/page.tsx` — shared gate
- `Frontend/web/src/app/(public)/cart/page.tsx` — account-required notice

**Related:** `cart-resume-feature.md` · `static-to-dynamic-audit.md` ·
`register-password-error-feedback-fix.md` · `compliance-implementation.md`
