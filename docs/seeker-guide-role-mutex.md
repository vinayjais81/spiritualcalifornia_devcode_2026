# SEEKER ↔ GUIDE Role Mutex

**Shipped:** 2026-04-28
**Owner:** Auth / Identity
**Companion to:** [seeker-deferred-onboarding.md](./seeker-deferred-onboarding.md), [guide-deferred-onboarding.md](./guide-deferred-onboarding.md)

## Policy

One email = one marketplace role.

- **`SEEKER`** and **`GUIDE`** are mutually exclusive on the same email.
- **`ADMIN`** and **`SUPER_ADMIN`** are exempt — platform staff can hold either marketplace role for testing without conflict.

The schema (`UserRole` join table) still permits multiple rows per user; the mutex is enforced at the application layer.

## Why

A single email holding both roles created ambiguity:

- Login routing didn't know which dashboard to show.
- Profile pages diverged — a seeker's `interests/practices` and a guide's `bio/credentials` lived on different tables for the same user.
- The new completeness widgets (seeker + guide) pulled different `completeness` blocks from different endpoints, so dual-role users would see two competing nudges.
- Verified-guide perceived trust signals (badge, public profile) shouldn't be muddied by a parallel seeker history.

## Enforcement points (defence in depth)

### 1. `/auth/register` — diverging side-effects per intent

`RegisterDto` now accepts an optional `intent: 'seeker' | 'guide'` field (default `'seeker'`).

- `intent: 'seeker'` (default): assigns `SEEKER` role + creates `SeekerProfile` (legacy behaviour).
- `intent: 'guide'`: skips both. The user is created with **no marketplace role** until `/guides/onboarding/start` runs and assigns `GUIDE`.

The legacy "email already registered" check still rejects any duplicate email upfront, so a guide's email can't be reused on the seeker side and vice versa.

### 2. `/guides/onboarding/start` — explicit cross-role guard

Even if a client somehow bypasses the `intent` parameter, `GuidesService.startOnboarding` checks the user's existing roles before assigning `GUIDE`:

```ts
if (userRoles.includes(Role.SEEKER)) {
  throw new ConflictException(
    'This email is already registered as a seeker. Please sign out and register as a guide using a different email.',
  );
}
```

This is the safety net — old clients, direct API calls, or replay attacks all hit it.

### 3. Frontend cross-role block pages

Two friendly blocking UIs (one per direction) so users hit a clear message before the backend rejects them:

- **`/onboarding/guide`** — `OnboardingWizard` detects an authenticated `SEEKER` (without `GUIDE`) and renders a `CrossRoleBlock` component instead of the wizard. Offers "Sign out & register as guide" button (logs out → returns to `/onboarding/guide` for fresh-email registration) plus "Back to my dashboard" link.
- **`/register`** — Symmetric block: an authenticated `GUIDE` (without `SEEKER`) sees "This email is already a guide" with a "Go to my guide dashboard" CTA.

Both bypasses skip the wizard entirely; backend never sees a request that would conflict.

### 4. Login routing precedence (already in place)

[`signin/page.tsx`](../Frontend/web/src/app/signin/page.tsx) routes by role priority: **`ADMIN > redirect query > GUIDE > SEEKER > /`**. With the mutex enforced, every non-admin user has exactly one of `(SEEKER, GUIDE)`, so this routing is now unambiguous.

## Backfill

Migration [`20260428100000_enforce_seeker_guide_mutex`](../Backend/api/prisma/migrations/20260428100000_enforce_seeker_guide_mutex/migration.sql):

```sql
DELETE FROM "user_roles"
WHERE "role" = 'SEEKER'
  AND "userId" IN (SELECT "userId" FROM "user_roles" WHERE "role" = 'GUIDE');
```

**Decision: drop SEEKER from any user that has both.** Reasoning: guides have a real verified profile + identity record; that's the truer signal of intent. Their `GuideProfile` survives intact. Their `SeekerProfile` row stays in the DB (no cascade delete) so historical bookings/orders aren't lost — it's just disconnected from the user's marketplace identity.

The migration logs the affected count via `RAISE NOTICE` so operators can spot-check in the deploy log. Idempotent — re-running is a no-op.

## What this changes for users

| Scenario | Before this change | After |
|---|---|---|
| Brand-new guide registers | User created with both `SEEKER` + `GUIDE` roles after onboarding/start | User created with `GUIDE` only |
| Existing seeker tries `/onboarding/guide` | Could also become a guide; ended up with both roles | Friendly block page; must use a different email |
| Existing guide visits `/register` | Could double-register as seeker on the same email | Friendly block page; CTA to guide dashboard |
| Admin who's also testing as seeker/guide | Worked | Still works — admins exempt |
| Existing dual-role user | Lived in ambiguous state | `SEEKER` row dropped on next deploy; profile keeps `GUIDE` |

## Verification checklist (post-deploy)

1. **Migration ran:** `psql -c "SELECT COUNT(*) FROM user_roles WHERE role='SEEKER' AND userId IN (SELECT userId FROM user_roles WHERE role='GUIDE')"` returns `0`.
2. **Brand-new guide registration:** new guide account has `roles=['GUIDE']` only (not `['SEEKER', 'GUIDE']`).
3. **Seeker → guide block:** sign in as an existing seeker, visit `/onboarding/guide` → see "This email is already a seeker" page, NOT the wizard.
4. **Guide → seeker block:** sign in as an existing guide, visit `/register` → see "This email is already a guide" page, NOT the wizard.
5. **API safety net:** `curl -X POST /api/v1/guides/onboarding/start` as a SEEKER returns 409 with the friendly message (even if frontend block is bypassed).
6. **Admin exemption:** an ADMIN account can still proceed through `/onboarding/guide` if they want to also be a guide for testing.

## Code reference

- DTO field: [`Backend/api/src/modules/auth/dto/register.dto.ts`](../Backend/api/src/modules/auth/dto/register.dto.ts) → `intent?: 'seeker' | 'guide'`
- Register branching: [`AuthService.register`](../Backend/api/src/modules/auth/auth.service.ts)
- Cross-role guard: [`GuidesService.startOnboarding`](../Backend/api/src/modules/guides/guides.service.ts)
- Migration: [`20260428100000_enforce_seeker_guide_mutex/migration.sql`](../Backend/api/prisma/migrations/20260428100000_enforce_seeker_guide_mutex/migration.sql)
- Guide-side UI block: [`OnboardingWizard.tsx`](../Frontend/web/src/components/onboarding/OnboardingWizard.tsx) → `CrossRoleBlock`
- Seeker-side UI block: [`/register/page.tsx`](../Frontend/web/src/app/register/page.tsx) → inline `isExistingGuide` branch
- Frontend intent pass: [`Step1Profile.tsx`](../Frontend/web/src/components/onboarding/steps/Step1Profile.tsx) → `/auth/register` body
