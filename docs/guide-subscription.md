# Guide Subscription ($50/mo Standard Listing)

Implements the recurring listing subscription for guides that the
`/guide/dashboard/subscription` page previously only advertised (the Subscribe
buttons were static placeholders with no backend). Built 2026-07-13.

## Plans

| Plan     | Price      | Stripe interval |
|----------|------------|-----------------|
| Standard | $50 / month | `month`        |
| Annual   | $480 / year | `year` (saves $120) |

Both map to the same feature set (Standard listing); Annual adds priority search
placement + newsletter feature (marketing copy only for now).

## Free listing period

Every guide gets a free listing period of `GUIDE_FREE_PERIOD_DAYS` (default 90)
days from account creation. When a guide subscribes **during** that window, the
remaining days are passed to Stripe as a `trial_period_days` so they are not
charged until the free period ends. After it elapses, subscribing charges
immediately.

The free period is currently cosmetic (not enforced by a hard gate); the
subscription flow simply honors it on the billing side.

## Data model

Reuses the pre-existing `GuideSubscription` model (in the init migration) and
`SubscriptionStatus` enum — **no migration was required**.

```
GuideSubscription { guideId @unique, stripeSubscriptionId @unique, status,
                    currentPeriodStart, currentPeriodEnd, cancelledAt }
SubscriptionStatus = ACTIVE | TRIALING | PAST_DUE | CANCELLED
```

We deliberately do **not** persist a Stripe customer id: the billing-portal flow
resolves the customer from the live subscription object at call time.

## Backend

- **StripeService** (`modules/payments/stripe.service.ts`)
  - `getSubscriptionPriceId(interval)` — returns the env Price ID if it is a real
    `price_...` id, else looks one up by `lookup_key`
    (`guide_standard_monthly` / `guide_standard_annual`) and lazily creates a
    Product + recurring Price. This makes the flow work out-of-the-box in the
    Stripe sandbox. **A bare amount like `50` in the env is ignored** (guards a
    common misconfiguration).
  - `createSubscriptionCheckout(...)` — hosted Checkout in `mode: 'subscription'`,
    stamps `{ guideId, plan }` metadata on both the session and the subscription.
  - `createBillingPortalSession(customerId, returnUrl)` — Stripe billing portal.
  - `retrieveSubscription(id)`.

- **PaymentsService** (`modules/payments/payments.service.ts`)
  - `createSubscriptionCheckout(userId, plan)` — blocks if an ACTIVE/TRIALING sub
    exists; computes remaining free days as the trial; returns `{ url }`.
  - `getSubscriptionStatus(userId)` — plans + free-period state + current sub.
  - `createSubscriptionPortal(userId)` — resolves the customer from the live
    subscription and returns a portal `{ url }`.
  - Webhook cases added to `handleStripeWebhook`:
    - `customer.subscription.created` / `updated` → `upsertGuideSubscriptionFromStripe`
      (maps Stripe status → our enum, mirrors billing period).
    - `customer.subscription.deleted` → mark CANCELLED, but only if our row still
      tracks that subscription id (guards a stale delete clobbering a newer sub).
    - `checkout.session.completed` now branches on `session.mode` — subscription
      checkouts skip the one-time `confirmPayment` path (they carry no
      session-level PaymentIntent).

- **Controller** routes (all `@Roles(GUIDE)`, placed above the `:id` wildcard):
  - `GET  /payments/subscription/status`
  - `POST /payments/subscription/checkout`  body `{ plan: 'monthly' | 'annual' }`
  - `POST /payments/subscription/portal`

## Frontend

`/guide/dashboard/subscription` rewritten to a client page (react-query):
- Reads `GET /payments/subscription/status`.
- Shows the real free-period banner (days left / ended) or, when subscribed, the
  current plan with status badge + **Manage Billing** (→ portal).
- Subscribe buttons POST to `/subscription/checkout` and redirect to Stripe.
- Handles the `?subscription=success|cancelled` return params with a toast +
  status refresh.

## Admin view

`/admin/subscriptions` (nav: **Subscriptions**) lists every guide subscription
from the `GuideSubscription` table — guide, plan status (Active / Free trial /
Payment due / Cancelled), current billing period, subscribe date, and Stripe
subscription id. Filter by status, search by guide name/email. Backed by
`GET /admin/subscriptions` (`admin.service.getSubscriptions`).

Because this reads OUR table, a subscription only appears here **after the
Stripe webhook delivers `customer.subscription.created`**. If a paid Stripe
subscription is missing from this list, the webhook events are not reaching the
`/payments/webhook/stripe` endpoint (see setup below).

## Config / env

```
STRIPE_SUBSCRIPTION_PRICE_MONTHLY=   # optional Stripe price_... id (else auto-created)
STRIPE_SUBSCRIPTION_PRICE_ANNUAL=    # optional Stripe price_... id (else auto-created)
GUIDE_FREE_PERIOD_DAYS=90
```

**Production note:** create real recurring Prices in the Stripe dashboard and set
the two `price_...` IDs. Leaving them blank (or non-`price_` values) triggers the
sandbox lazy-create path.

## Stripe dashboard setup (webhooks)

The subscription events arrive on the **existing** payments webhook endpoint
(`POST /payments/webhook/stripe`, verified with `STRIPE_WEBHOOK_SECRET`). Ensure
these event types are enabled on that endpoint:
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `checkout.session.completed`.
