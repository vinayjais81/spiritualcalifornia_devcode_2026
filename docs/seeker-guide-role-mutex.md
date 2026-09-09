# SEEKER ↔ GUIDE Role Mutex

**Shipped:** 2026-04-28
**Superseded in part:** 2026-09-09 — see [practitioners-as-buyers.md](./practitioners-as-buyers.md)
**Owner:** Auth / Identity
**Companion to:** [seeker-deferred-onboarding.md](./seeker-deferred-onboarding.md), [guide-deferred-onboarding.md](./guide-deferred-onboarding.md)

> ## ⚠️ Read this first
>
> **The mutex is no longer symmetric.** It was "one email = one marketplace
> role" in both directions. Since 9 September 2026 it holds in one direction
> only:
>
> | Direction | Status |
> |---|---|
> | A seeker becoming a practitioner | **Still blocked.** Everything below about this direction is current. |
> | A practitioner also holding `SEEKER` | **Now the intended state.** Practitioners buy from each other. |
>
> The reason for the asymmetry is cost, not principle: opening the other
> direction pulls in identity verification, credential review, payout
> onboarding and the listing subscription. It was decision D1 in
> [practitioners-as-buyers.md](./practitioners-as-buyers.md), and it remains
> open for a future phase.
>
> Sections below are marked **current** or **retired** individually. Nothing
> here has been deleted, because the seeker→practitioner half is still live
> policy and this is still its documentation.

## Policy — amended

- **A seeker may not become a practitioner** on the same email. *(current)*
- ~~A practitioner may not also hold `SEEKER`.~~ *(retired — practitioners are
  granted `SEEKER` so they can buy; the grant runs through
  `UsersService.ensureBuyerAccess`, gated on `PRACTITIONER_BUYER_ENABLED`)*
- **`ADMIN`** and **`SUPER_ADMIN`** are exempt — platform staff can hold either
  marketplace role for testing. *(current)*

The schema (`UserRole` join table) always permitted multiple rows per user; the
mutex was only ever an application-layer rule. That is precisely why lifting
half of it needed no migration.

## Why it existed

A single email holding both roles created ambiguity:

- Login routing didn't know which dashboard to show.
  → *Resolved rather than retired: `GUIDE` is checked before `SEEKER` in both
  `signedInDestination` and `handleSubmit`, so practitioners keep landing on
  the practitioner dashboard. This ordering is now load-bearing.*
- Profile pages diverged — a seeker's `interests/practices` and a guide's
  `bio/credentials` live on different tables for the same user.
  → *Still true, and why the account menu now carries an explicit switcher
  (decision D6) rather than trying to merge the two.*
- Competing completeness nudges from the seeker and guide widgets.
  → *`OnboardingWizard` already suppresses itself on `SEEKER && !GUIDE`, so a
  practitioner never sees the seeker nudge.*
- Verified-practitioner trust signals shouldn't be muddied by a parallel buyer
  history.
  → *This concern is now handled by the self-dealing guards
  (`common/self-dealing.ts`) and the D5 peer-review label, not by role
  exclusion.*

## Enforcement points

### 1. `/auth/register` — diverging side-effects per intent *(current)*

`RegisterDto` accepts an optional `intent: 'seeker' | 'guide'` (default
`'seeker'`).

- `intent: 'seeker'`: assigns `SEEKER` + creates `SeekerProfile`.
- `intent: 'guide'`: creates the `GuideProfile` shell and assigns `GUIDE`, then
  calls `ensureBuyerAccess` — a no-op while the feature flag is off.

The duplicate-email check still rejects a reused address upfront.

### 2. `/guides/onboarding/start` — cross-role guard *(current, unchanged)*

`GuidesService.startOnboarding` still refuses a caller who already holds
`SEEKER`:

```ts
if (userRoles.includes(Role.SEEKER)) {
  throw new ConflictException(
    'This email is already registered as a seeker. Please sign out and register as a guide using a different email.',
  );
}
```

This is the seeker→practitioner direction, which D1 keeps closed. It does **not**
fire for practitioners who now hold `SEEKER`, because the
already-has-a-`GuideProfile` early return precedes it. **Do not reorder those two
blocks** — that would lock every practitioner out of their own onboarding.

### 3. Frontend cross-role block pages *(one current, one amended)*

- **`/onboarding/guide`** *(current)* — `OnboardingWizard` detects an
  authenticated `SEEKER` without `GUIDE` and renders `CrossRoleBlock`. The
  `&& !GUIDE` clause is what keeps this correct for dual-role practitioners.
- **`/register`** *(amended)* — the block now triggers on `GUIDE` alone. It
  previously required `GUIDE && !SEEKER`, which inverted the moment
  practitioners held both roles: the block vanished and practitioners were
  served the seeker signup wizard.

### 4. Login routing precedence *(current, and now load-bearing)*

[`signin/page.tsx`](../Frontend/web/src/app/signin/page.tsx) routes by
**`ADMIN > redirect query > GUIDE > SEEKER > /`**.

The old note here said the mutex made this "unambiguous" because every non-admin
held exactly one of the two. **That is no longer true**, which makes the
precedence more important, not less: practitioners hold both, and reversing
`GUIDE` and `SEEKER` in either routing function would land every practitioner on
the buyer dashboard.

### 5. Admin role editor *(new, 2026-09-09)*

`PATCH /admin/users/:id/roles` applied whatever it was handed. It now validates:
staff roles require a `SUPER_ADMIN` actor, nobody edits their own roles, `GUIDE`
requires an existing `GuideProfile`, `SEEKER` creates the missing
`SeekerProfile`, and the practitioner role can't be stripped from a still-
published profile. See `set-user-roles.spec.ts`.

This is the gap that made the pre-Phase-1 production audit necessary: the editor
never consulted the mutex, so accounts could already hold both roles.

## Backfill *(historical)*

Migration
[`20260428100000_enforce_seeker_guide_mutex`](../Backend/api/prisma/migrations/20260428100000_enforce_seeker_guide_mutex/migration.sql)
dropped `SEEKER` from any user holding both, keeping the orphaned
`SeekerProfile` row so historical bookings survived.

That decision is why the 2026-09 rollout **adopts an existing `SeekerProfile`
rather than creating a new one**: the accounts this migration touched still have
their old profile, and it still owns their purchase history. Creating a second
one would orphan it a second time.

## What this changes for users

| Scenario | Before 2026-04 | 2026-04 → 2026-09 | Now |
|---|---|---|---|
| Brand-new practitioner registers | `SEEKER` + `GUIDE` | `GUIDE` only | `GUIDE` + `SEEKER` (flag on) |
| Seeker tries `/onboarding/guide` | Ended up with both | Friendly block | Friendly block — unchanged |
| Practitioner visits `/register` | Double-registered | Friendly block | Friendly block — unchanged |
| Practitioner buys from another | Impossible | Impossible | Supported |
| Practitioner buys from themselves | Possible in principle | Blocked by the mutex, by accident | Blocked deliberately |
| Admin testing both hats | Worked | Worked | Works |

## Verification checklist

1. **Seeker → practitioner block:** sign in as a seeker, visit
   `/onboarding/guide` → block page, not the wizard.
2. **Practitioner → `/register` block:** sign in as a practitioner, visit
   `/register` → block page. Confirm this still holds *after* they hold `SEEKER`
   — that is the case that used to invert.
3. **API safety net:** `POST /guides/onboarding/start` as a `SEEKER` returns 409.
4. **Routing:** a dual-role practitioner lands on the practitioner dashboard,
   not the buyer one.
5. **Admin exemption:** an `ADMIN` can still walk `/onboarding/guide`.

~~Check `user_roles` holds no user with both `SEEKER` and `GUIDE`.~~ *(retired —
that state is now the expected one. Use `npm run audit:dual-role` to inspect it
rather than to assert it is empty.)*

## Code reference

- Register branching: [`AuthService.register`](../Backend/api/src/modules/auth/auth.service.ts)
- Cross-role guard: [`GuidesService.startOnboarding`](../Backend/api/src/modules/guides/guides.service.ts)
- Buyer grant: [`UsersService.ensureBuyerAccess`](../Backend/api/src/modules/users/users.service.ts)
- Admin editor: [`AdminService.setUserRoles`](../Backend/api/src/modules/admin/admin.service.ts)
- Guide-side UI block: [`OnboardingWizard.tsx`](../Frontend/web/src/components/onboarding/OnboardingWizard.tsx) → `CrossRoleBlock`
- Seeker-side UI block: [`/register/page.tsx`](../Frontend/web/src/app/register/page.tsx) → `isExistingGuide`
