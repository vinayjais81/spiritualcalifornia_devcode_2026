# Payment Bypass — Verifying the Charge Before Fulfillment

Fixes **DEFECT-003 / PAY-SEC-002**: `POST /payments/confirm-payment` marked
orders PAID without a verified Stripe charge. Severity: critical (authenticated
payment bypass → free goods, fulfillment side-effects, revenue loss).

Confirmed live end-to-end on QA before the fix.

## The vulnerability

`PaymentsService.confirmPayment` trusted its caller completely:

```ts
const payment = await this.prisma.payment.findUnique({
  where: { stripePaymentIntentId: paymentIntentId },
});
if (!payment) return;                       // silent no-op → 201
if (payment.status === 'SUCCEEDED') return payment;

// …marks Payment SUCCEEDED, Order PAID, fires handleOrderPaid()
```

It never called Stripe. The only input was a PaymentIntent id — and
`POST /orders` hands the client its own `clientSecret`, of which the intent id
is simply the prefix before `_secret_`. So the whole attack was:

1. `POST /orders` → `order.id` (PENDING) + `paymentIntent.clientSecret`
2. split the id off the client secret
3. `POST /payments/confirm-payment { paymentIntentId }` — pay nothing
4. order is PAID; `handleOrderPaid` generates 7-day download URLs and emails a receipt

Any authenticated seeker, on their own order. No payment required at all.

Two smaller faults in the same handler:

- an unknown intent (`pi_invalid_123`) returned **201** via the `if (!payment) return`
  path, reading as success
- no amount check anywhere

## The fix

Verification now happens on a single entry point, before anything is applied.

```ts
const intent = await this.stripeService.retrievePaymentIntent(paymentIntentId);
if (intent.status !== 'succeeded') throw new BadRequestException(…);

const expectedCents = await this.amountOwedCents(payment);
if (expectedCents !== null && (intent.amount_received ?? 0) < expectedCents) {
  throw new BadRequestException('The amount paid does not cover the amount due.');
}
```

Design points worth keeping:

**One door, no trusted-caller flag.** The webhook path calls the same
`confirmPayment` and is therefore verified too. A `{ verified: true }` bypass
option would have saved one Stripe call and created a parameter that is
catastrophic to pass by mistake. The redundant `retrievePaymentIntent` on the
webhook path is the cheaper trade.

**Amount is checked against the entity, not `payment.amount`.**
`amountOwedCents(payment)` reads the linked `Order` / `Booking` /
`TicketPurchase` / `TourBooking` total. Checking against `payment.amount` would
be circular: that column is written from the `amount` supplied on
create-intent, so it only proves the client agreed with itself. Tour bookings
resolve per instalment (`chosenDepositAmount` → `depositAmount` → `balanceAmount`).
It returns `null` when there is no linked entity (e.g. subscriptions), in which
case the succeeded-status check stands alone.

**Underpayment is rejected; overpayment is not.** Only underpayment is a threat.

**404 instead of a silent 201.** The client-facing endpoint now goes through
`confirmPaymentFromClient`, which turns "no local Payment row" into a
`NotFoundException`. `confirmPayment` itself still returns `undefined` there,
because Stripe Checkout sessions legitimately have no Payment row and the
webhook must not throw for them.

**Webhook failures never become retry storms.** `confirmPayment` throws now, and
an exception inside `handleStripeWebhook` returns 5xx, which makes Stripe
redeliver the same event indefinitely. Both webhook call sites wrap it in
try/catch: the confirmation aborts, the event is acked, and the failure is
logged loudly for manual review. A genuinely succeeded intent that fails our own
amount cross-check is a case for a human, not for infinite retries.

## Correction to the report's "subsumes" note

The report says create-intent "trusts a client-supplied amount with no
cross-check against the order total". For the **orders** flow that is not the
case: `OrdersService` computes `totalAmount` server-side and calls
`createPaymentIntent({ amount: totalAmount })` itself — the browser never
supplies it. `POST /payments/create-intent` *is* directly callable with an
arbitrary amount, but that no longer achieves anything, because confirmation now
cross-checks the captured amount against the entity total. Paying $1 on a $120
order fails at confirm time.

This is also why the amount check is safe to ship: for legitimate order
checkouts the expected and charged amounts derive from the same server-side
figure, so they always agree.

## Tests

`Backend/api/src/modules/payments/confirm-payment-verification.spec.ts` — 16
cases:

- the bypass itself: a real intent id with no payment made is refused, and
  `paymentUpdate` / `orderUpdate` / `handleOrderPaid` are all asserted *not*
  called (the invariant that matters is that nothing is applied, not merely that
  it throws)
- every non-succeeded status refused: `requires_payment_method`,
  `requires_confirmation`, `requires_action`, `processing`, `canceled`
- Stripe is always consulted; an intent Stripe doesn't recognise is refused
- underpayment refused even when the status is genuinely `succeeded`
- the amount is compared against the order total, not `payment.amount`
- exact payment succeeds; overpayment tolerated
- float-derived totals (`79.99 + 6.60` → 8659 cents) still reconcile
- idempotent on an already-succeeded payment, without calling Stripe
- unknown intent: `undefined` from `confirmPayment`, `NotFoundException` from
  `confirmPaymentFromClient`

## Notes

The QA regression test PAY-SEC-002 holds the secure assertion under
`test.fail()`, so it will now **fail loudly** — that failure is the fix landing.
Remove the `test.fail()` marker.

One PAID order exists on the test seeker account in the dev database from
proving the bypass. Left in place — it is dev-only data and not ours to clean up
unilaterally.

Worth reviewing separately: `handleOrderPaid` runs fire-and-forget from the
confirmation path. That is correct for resilience, but it means a fulfillment
failure is invisible outside the logs. A retry or a dead-letter record would be
an improvement, independent of this fix.
