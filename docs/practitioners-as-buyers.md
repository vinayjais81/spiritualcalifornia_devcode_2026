# Practitioners as buyers

Letting verified practitioners purchase other practitioners' services, events,
tours and products.

Assessment presented to the client 8 September 2026; decisions returned and
accepted 9 September 2026. This document is the record of what was agreed and
why, and the working plan for the four phases.

---

## The decisions

Seven calls were put to the client with a recommendation each. Six were
accepted as recommended; one was overridden.

| # | Decision | Chosen |
|---|---|---|
| D1 | How far this opens up | **Practitioners can buy.** Buyers becoming practitioners stays closed — that direction pulls in identity verification, credential review, payout onboarding and the listing subscription. |
| D2 | Who gets buyer access | **Every practitioner, automatically.** No opt-in step to discover. |
| D3 | Buying your own listing | **Refused outright.** |
| D4 | Commission on peer sales | **Standard rates** — 20% services/events/tours, 10% products. A sale is a sale. |
| D5 | Peer reviews | **Labelled as a practitioner review.** ⚠️ Client override — see below. |
| D6 | Where a dual-role account lands after sign-in | **Practitioner dashboard, with a switcher.** Preserves exactly what practitioners see today. |
| D7 | Sequencing | **Start next, run to completion.** One continuous block. |

### D5 is a deliberate departure from our recommendation

We recommended treating a peer review like any other verified purchase: no
special treatment, no new surface to game. The client chose to label it, having
read and accepted the stated trade-off — *"potentially a strong trust signal for
seekers, but creates an incentive for practitioners to review each other
favourably."*

Two consequences follow, and both are already handled:

- **The label is stamped at write time, not derived on read.** `Review.authorIsPractitioner`
  records whether the author held the GUIDE role *when they wrote the review*.
  Joining the author's current roles on read would relabel a seeker's entire
  review history the day they became a practitioner — turning years of ordinary
  reviews into peer reviews retroactively.
- **Every pre-existing row is correctly `false`.** Until this change no account
  could hold both roles, so no existing review can have been written by a
  practitioner. The migration's `DEFAULT false` is accurate, not just convenient.

Watch the reciprocity risk this creates. If peer reviews cluster into mutual
5-star pairs, that is the incentive D5 introduced showing up in the data, and it
is worth revisiting with the client rather than absorbing quietly.

---

## Why this is cheaper than it looks

Three structural facts, verified against `main`:

1. **Roles are a list, not a value.** `UserRole` is one row per role
   (`schema.prisma`), so holding two roles has always been legal at the data
   layer.
2. **Both profiles are optional on the same account.** Nothing prevents one
   `User` carrying both a `GuideProfile` and a `SeekerProfile`.
3. **Every purchase points at the buyer profile.** `Booking`, `Order`,
   `TicketPurchase`, `TourBooking` and `Favorite` all reference `SeekerProfile`,
   never `User` directly. Create that profile and the purchase paths work.

So no schema migration is needed for the feature itself, no downtime, and no
destructive change. Roughly 30 existing endpoints begin working unmodified,
because the permission checks already ask *"does this user hold the buyer
role?"* rather than *"is this user only a buyer?"*.

The restriction being lifted is a policy written into application code in April
(`guides.service.ts` — SEEKER and GUIDE are mutually exclusive at registration),
not a constraint built into the data.

**Worth knowing:** practitioners can already fill a shopping cart today. The
cart and checkout screens never check role — a signed-in practitioner can
browse, add items and complete the entire checkout form, only to be refused at
submit. The current behaviour is not "practitioners can't buy"; it is a
half-built version of this request, failing at the worst possible moment.

---

## The hard gate

**Phase 1 cannot precede Phase 0.** The moment a practitioner holds buyer access
without the self-purchase block in place, three things open at once:

- **Fake verified reviews.** Reviews require a completed purchase. Buying your
  own listing makes you eligible to review yourself, carrying a *verified
  purchase* badge — a direct attack on the trust-through-verification promise
  the marketplace is built on.
- **Inflated sales figures** and manufactured social proof on profiles.
- **A payment loop.** A purchase on a stolen card settles the practitioner's
  share into their own connected payout account while the chargeback lands on
  the platform. A well-known card-testing pattern and a real financial exposure.

They may ship together, or in this order — never the reverse.

We have made that gate structural rather than procedural: **the self-dealing
guards are not behind the feature flag.** They ship unconditionally. Today they
are unreachable, because no account holds both roles, so shipping them early
changes nothing for users — and it makes it impossible to turn the feature on
with the safeguard switched off.

---

## Phases

### Phase 0 — Safeguards and switch ✅ shipped

Invisible in production. Nothing changes for users.

- **Self-purchase blocked across all four purchase paths.** `common/self-dealing.ts`
  holds the guard; called from `bookings.service.ts` (both entry points —
  `createServiceBooking` and `create`), `orders.service.ts` (per cart line, so a
  mixed cart names the offending product), `tickets.service.ts` and
  `soul-tours.service.ts`.
- **Second-line protection in reviews.** `reviews.service.ts` refuses when the
  review's guide is the author, independently of the purchase guards. Only
  reachable if a self-purchase got through anyway — which is exactly when it
  matters.
- **Self-favouriting blocked.** Not a payment risk, but the count is social
  proof on the profile.
- **Sessions re-check roles.** `jwt.strategy.ts` now reads roles from the
  database rather than the token's sign-in snapshot. Without this, a
  practitioner granted buyer access still cannot buy until their session
  refreshes — up to 15 minutes of "it isn't working" that resolves itself, the
  hardest kind of report to diagnose. Revocation now also takes effect on the
  next request rather than surviving in a token.
- **`Review.authorIsPractitioner`** added for D5 (migration
  `20260909120000_review_author_is_practitioner`).
- **`PRACTITIONER_BUYER_ENABLED`** declared in `env.validation.ts`. Default off.
  A backend env var not declared there is silently stripped by Zod and never
  reaches the app.
- **Production audit script** — `npm run audit:dual-role`.

Guards compare `GuideProfile.userId` against the buyer's `User.id`, never
`GuideProfile.id`: those are different id spaces and a direct comparison would
silently never match.

**Test cover:** `src/common/self-dealing.spec.ts`, including a source-level
assertion that every purchase path still calls the guard. Crude, but it fails
loudly when a refactor drops a call — the failure mode this codebase has
actually hit before (nested price edits, `PUBLIC_GUIDE_WHERE` on offering reads).

### Phase 1 — Grant buyer access (1–2 days)

Create the `SeekerProfile` and SEEKER role for practitioners, plus a re-runnable
backfill for existing accounts following the report → trial → execute pattern
used by `purge-demo-data.ts`. No endpoint changes needed. Fully reversible:
removing the granted role restores current behaviour.

Run `npm run audit:dual-role` first. If it reports accounts that already hold
both roles — the admin role editor applies whatever it is handed and never
consulted the mutex — the backfill must adopt their existing profiles rather
than create new ones.

### Phase 2 — Front-end experience (4–5 days)

Where the effort actually sits, and the phase most likely to grow: it is a hunt
for implicit assumptions rather than a list of known edits.

- A dashboard switcher for dual-role users.
- Sign-in routing that no longer depends on which role is checked first
  (`signin/page.tsx`, `Navbar.tsx`).
- Unwind screens that read "is a buyer" as "is not a practitioner" — the
  "List Your Practice" CTA reappearing for people who already have a practice,
  existing practitioners hitting the wrong-account block screen.
- Suppress buyer onboarding prompts on practitioner accounts.
- Render the D5 practitioner-review label from `authorIsPractitioner`.

### Phase 3 — Consistency and testing (2–3 days)

- Retire the superseded one-role-per-account policy documentation.
- Validation on the admin role editor so it cannot create invalid combinations.
- Regression across both dashboards; end-to-end purchase tests.

**Total: 10–14 working days** for one senior developer.

---

## Not affected

No schema migration for the feature itself, so no downtime and no destructive
database change. Payouts and the accounting ledger key off `GuideProfile` while
purchases key off `SeekerProfile` — they do not intersect. Commission handling,
refunds, clawbacks and public listing visibility are unchanged. There is no
conflict between someone's buyer identity and their payout account in Stripe:
the platform stores no customer record against user accounts, so the two never
meet.

---

## Open item

The **cart** is not part of the Phase 0 guard set. A practitioner can still add
their own product to a cart; the refusal lands at order creation
(`orders.service.ts`), where it is enforced for real. That is safe but late —
Phase 2 should filter self-owned items at add-to-cart so the refusal is not the
first the buyer hears of it.
