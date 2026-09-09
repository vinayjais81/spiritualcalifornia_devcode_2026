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

### Phase 1 — Grant buyer access ✅ shipped (flag off)

`UsersService.ensureBuyerAccess(userId)` is the single grant path: creates the
`SeekerProfile` and SEEKER role, idempotently, and only when
`PRACTITIONER_BUYER_ENABLED=true`. It is called from all three places a
practitioner account comes into existence — register-with-intent and
verify-email-with-intent (`auth.service.ts`) and `startOnboarding`
(`guides.service.ts`) — because those three paths have already drifted from
each other once, and a buyer profile present on two of three routes would fail
invisibly until someone tried to buy.

It **adopts an existing `SeekerProfile` rather than replacing it.** An account
can hold a profile without the role (the admin role editor can strip a role
without touching the profile), and that profile owns the entire purchase history
via `SeekerProfile.id` — a second one would orphan it.

The mutex in `startOnboarding` is unchanged and still refuses a seeker becoming
a practitioner (D1). It never fires for practitioners, because the
already-has-a-GuideProfile early return precedes it. **Do not reorder those two
blocks** — that would lock every practitioner out of their own onboarding.

Backfill for existing accounts: `npm run buyer-access:report | :trial | :execute`
(report → trial → execute, same shape as `purge-demo-data.ts`; trial runs the
real grant in a transaction and rolls it back). Re-runnable, so it can be rolled
out in batches. Reversible by deleting the granted SEEKER rows.

Run `npm run audit:dual-role` first.

**Test cover:** `src/modules/users/buyer-access.spec.ts` — off by default, off
for any value but the literal `"true"`, idempotent, and the adopt-don't-replace
rule.

### Phase 2 — Front-end experience ✅ shipped

The proposal called this "an audit, not a fixed list". Having done the audit, it
is a fixed list — smaller than feared. Two places already handle dual-role
correctly by accident and need no change: `OnboardingWizard.tsx` suppresses
itself on `SEEKER && !GUIDE`, and `Navbar.tsx` gates the "List Your Practice"
CTA on `isGuide` alone.

What shipped:

- **The `register/page.tsx` inversion** (`GUIDE && !SEEKER` → `GUIDE`), fixed
  ahead of the rest because it is armed by the flag rather than by a deploy.
- **`guideProfileId` / `guideSlug` on the session.** Added through one shared
  `AUTH_USER_INCLUDE` and mirrored into `jwt.strategy` so `GET /auth/me` returns
  the same shape the login response does — the client rehydrates from
  `/auth/me`, and a field present at login but missing on refresh would make the
  self-dealing checks pass and fail at random.
- **`lib/self-dealing.ts`** — the client mirror of the server rule, applied to
  the service booking page, the tour booking page, the favourite button and both
  add-to-cart paths. It resolves **false** when the identifier is missing, on
  purpose: guessing wrong that way is a cosmetic bug, guessing wrong the other
  way hides the buy button from everyone when data fails to load.
- **The dashboard switcher (D6)** — "Practitioner Dashboard" / "My Purchases" in
  the account menu, desktop and mobile. Single-role users see the unchanged
  single entry, so it is invisible to every seeker on the platform.
- **The D5 label**, on the guide profile and in the shared reviews block.
- A false comment in `signin/page.tsx` claiming `signedInDestination` and
  `handleSubmit` "can't drift". They had already diverged, and legitimately —
  one routes someone who just authenticated and may have an unfinished wizard,
  the other someone already signed in who wandered onto `/signin`. What they
  must keep agreeing on is that **GUIDE is checked before SEEKER**; reversing
  that in either place lands every practitioner on the buyer dashboard.

The client mirror is UX only. The server refuses every one of these regardless,
and nothing here should ever be treated as the enforcement point.

### Phase 3 — Consistency and testing ✅ shipped

**Admin role editor.** `PATCH /admin/users/:id/roles` applied whatever it was
handed, with no validation at all. It now enforces:

- **Staff roles require a `SUPER_ADMIN` actor.** Any `ADMIN` could previously
  grant `SUPER_ADMIN` to any account, including a second account they control.
  The adjacent `setUserPassword` has always had this rail; this endpoint never
  did. Checked on the *difference*, not the resulting set, so a plain admin can
  still edit the marketplace roles of an account that holds a staff role.
- **Nobody edits their own roles**, mirroring the deactivate flow.
- **A role must have its profile behind it.** `GUIDE` without a `GuideProfile`
  breaks every practitioner screen, so it is refused (onboarding's job, and D1
  keeps that direction closed). `SEEKER` without a `SeekerProfile` 403s on every
  purchase — the checkout paths start from a profile lookup, not a role check —
  so that profile is created.
- **`GUIDE` can't be stripped from a published profile.** Public visibility keys
  off `isVerified`/`isPublished`/`isActive`, not the role, so this would leave a
  live listing whose owner cannot reach their dashboard to manage it.
- **Empty role sets rejected**, and roles deduplicated (`createMany` would
  otherwise trip the `(userId, role)` unique constraint).
- **Audit-logged** as `admin.user.roles`, with before/after.

Cover in `src/modules/admin/set-user-roles.spec.ts` (13 tests).

**Documentation.** [seeker-guide-role-mutex.md](./seeker-guide-role-mutex.md)
rewritten as *superseded in part* rather than deleted — the seeker→practitioner
half is still live policy and that is still its spec. Each section is marked
current or retired individually, including the claim in its routing section that
"every non-admin user has exactly one of (SEEKER, GUIDE)", which is now false and
was the assumption most likely to mislead someone later. The entry in
`static-to-dynamic-audit.md` carries a supersession note.

**Regression sweep.** Every remaining role check in both codebases reviewed. All
surviving backend checks are positive `@Roles(Role.SEEKER)` guards on purchase
endpoints, which practitioners now legitimately pass; no other place infers "is
not a practitioner" from the buyer role.

**Total: 10–14 working days** estimated; delivered in one session across four
commits, with Phase 2 coming in under estimate because the audit it was priced
for turned out to be a fixed list.

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

## Go-live sequence

Once Phases 2 and 3 are done, turning this on is four ordered steps:

1. Apply the migration to production.
2. `npm run audit:dual-role` — read-only, tells you what the backfill will meet.
3. `npm run buyer-access:report` → `:trial` → `:execute --confirm=<db>`. Nothing
   changes for users yet: the grant is a no-op while the flag is off, and the
   backfill's own writes are inert without it.
4. Set `PRACTITIONER_BUYER_ENABLED=true` on the API and restart. **This is the
   step that switches the feature on.** Sessions pick the new role up on their
   next request (Phase 0's `jwt.strategy` change), not on next sign-in.

To roll back, unset the flag. The granted roles can stay; without the flag
nothing reads them differently, and the self-dealing guards remain in force
either way.

## Open items

- **Carts saved before Phase 2** can still hold a practitioner's own product:
  the cart is persisted client-side, and the guard runs at add time. The refusal
  lands at order creation (`orders.service.ts`), per line, so the rest of the
  cart still checks out. Worth a sweep on the cart page if it shows up in
  testing.
- **`ReviewsSection.tsx`** (shop) renders from its own flattened
  `{ authorName, verified }` shape rather than the API review, so the D5 label
  is not on it. Everywhere reviews come from the reviews API — the guide profile
  and `ReviewsBlock` — has it.
- **Peer-review reciprocity** — the incentive the client accepted in D5. If peer
  reviews start clustering into mutual 5-star pairs, that is the trade-off
  showing up in the data, and it should go back to them rather than be absorbed.
