# Verify Email Before Login

**Shipped:** 2026-04-28
**Owner:** Auth / Identity
**Companion to:** [seeker-guide-role-mutex.md](./seeker-guide-role-mutex.md)

## Threat closed

Before this change, `/auth/register` returned access + refresh tokens immediately. A bad actor could:

1. Register with someone else's email (typo or malicious) and get an authenticated session against that account.
2. Squat on the email — the legitimate owner couldn't register because `Email already registered` would block them.
3. Pollute the platform with profiles tied to identities they don't own.

The verification pipeline (Persona + admin review) eventually catches a fake guide before they go *public*, but until then they hold a session and can take authenticated actions.

## Policy now

**No session is issued until the user proves they own the email.** `/auth/register` only sends a verification email; tokens are minted by `/auth/verify-email` when the user clicks the link.

## Backend changes

### `User.pendingIntent` column

Migration [`20260428200000_user_pending_intent`](../Backend/api/prisma/migrations/20260428200000_user_pending_intent/migration.sql) adds:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pendingIntent" TEXT;
```

Set at register time (`'seeker' | 'guide'`). Read by `/auth/verify-email` to decide which role + profile side-effects to run. Cleared after verification.

### `AuthService.register`

- **No tokens, no refresh cookie.** Returns `{ user: { id, email, firstName, lastName }, requiresEmailVerification: true }`.
- **No role assigned, no profile created.** A pre-verified user has zero authority on the platform.
- Persists `pendingIntent` on the User row so verify-email knows what to do.
- Verification email is sent fire-and-forget.

### `AuthService.verifyEmail`

Now does four things on success:
1. Marks `isEmailVerified = true`, clears the verification token + `pendingIntent`.
2. Reads the persisted `pendingIntent` and runs the deferred side-effects:
   - `'seeker'` → create `SeekerProfile` + assign `SEEKER` role.
   - `'guide'` → create `GuideProfile` (with slug + displayName) + assign `GUIDE` role. Mirrors `GuidesService.startOnboarding`.
3. Mints access + refresh tokens — **first time** the user receives a session.
4. Returns `{ user, accessToken, intent, message }` and sets the refresh cookie.

Idempotent in the sense that double-clicking the verify link won't error — the second call finds the user already has roles and skips re-assignment.

### `AuthService.login`

New gate immediately after the password check:

```ts
if (!user.isEmailVerified) {
  throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
}
```

The `EMAIL_NOT_VERIFIED` sentinel string is what the frontend uses to render the "verify your email first" message instead of the generic "invalid credentials" wording.

### `AuthController.register` / `AuthController.verifyEmail`

- Register endpoint no longer calls `setRefreshTokenCookie` and no longer returns an access token.
- Verify-email endpoint now sets the refresh cookie and returns `{ user, accessToken, intent, message }` on success.

## Frontend changes

### Guide wizard `Step1Profile.tsx`

Added local state `awaitingVerification`. On unauthenticated submit:

1. Calls `/auth/register` with `intent: 'guide'` + name + email + password.
2. Sets `awaitingVerification` to the email address.
3. Renders the "Check your inbox" full-screen view instead of advancing.

The bio / tagline / avatar / location data the user filled in stays in the Zustand store (already persisted to localStorage). When they come back from the verify-email link, the wizard renders Step 1 again with their data still there, and the now-authenticated submit path saves the profile and advances to Step 2.

Removed the obsolete `refreshAuthWithLatestRoles` call and `setAuth` import — both were predicated on receiving tokens from `/auth/register`, which no longer happens.

### Seeker `/register`

`handleRegister` no longer calls `setAuth`. Step 2 hides the interests selector for non-Google users (they're not authenticated, can't save anyway) and shows only the "Check your inbox" message + "Resend it" link. Google users still see the interests selector — they're already verified.

### `/verify-email`

`useEffect` on success now reads `{ user, accessToken, intent }` from the response and calls `setAuth(user, accessToken)`. Redirect target is intent-driven:
- `intent === 'guide'` → `/onboarding/guide` (so the user can finish Step 1 with their saved Zustand data).
- otherwise → `/seeker/dashboard`.

Countdown shortened from 5 to 3 seconds.

### `/signin`

Error handler recognises the `EMAIL_NOT_VERIFIED` sentinel and shows a friendly explanatory message: "Your email address hasn't been verified yet. Please click the link we emailed you when you registered. Check your spam folder if you can't find it."

## Migration safety

| Existing data | Behaviour after deploy |
|---|---|
| Existing users with `isEmailVerified = true` | Unchanged — they log in normally. |
| Existing users with `isEmailVerified = false` (legacy) | Will hit the `EMAIL_NOT_VERIFIED` gate on next login. They need to click the original verification email or have an admin manually flip the flag. |
| Existing dual-role users (seeker + guide) | Already cleaned by [seeker-guide-role-mutex](./seeker-guide-role-mutex.md) migration. |
| Dev / test accounts | If they're stuck unverified, run: `psql "$DATABASE_URL" -c "UPDATE users SET \"isEmailVerified\" = true WHERE email = 'dev@example.com';"` |

The new `pendingIntent` column is only set at registration time going forward — existing User rows have `pendingIntent = NULL` and continue to work because the post-verify side-effects are gated on `existingRoles.length === 0`.

## State diagram

```
   Register form submit
            │
            ▼
   ┌─────────────────────────────────┐
   │ POST /auth/register             │
   │   - User row created            │
   │   - pendingIntent saved         │
   │   - email verification sent     │
   │   - NO tokens issued            │
   └─────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────┐
   │ "Check your inbox" screen       │
   │ (frontend)                      │
   └─────────────────────────────────┘
            │
            ▼ user clicks link
   ┌─────────────────────────────────┐
   │ GET /auth/verify-email?token=…  │
   │   - isEmailVerified = true      │
   │   - assign role + create profile│
   │   - mint tokens                 │
   │   - set refresh cookie          │
   └─────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────┐
   │ Frontend setAuth(user, token)   │
   │ Redirect by intent:             │
   │   guide  → /onboarding/guide    │
   │   seeker → /seeker/dashboard    │
   └─────────────────────────────────┘
```

## Verification checklist (post-deploy)

1. **Register fresh seeker** — submit /register form. `localStorage.access_token` should be EMPTY. UI shows "Check your inbox".
2. **Try to /signin without verifying** — should show "Your email address hasn't been verified yet…" message.
3. **Click verification link** — `/verify-email` runs, redirects to `/seeker/dashboard`. `localStorage.access_token` is now set.
4. **Register fresh guide** — `/onboarding/guide` Step 1 submit. UI shows "Check your inbox". Step 1 form data is in Zustand (visible if you reload).
5. **Click guide verification link** — `/verify-email` runs, redirects to `/onboarding/guide`. Wizard mounts, user is authenticated with GUIDE role + GuideProfile shell.
6. **Existing verified user login** — works as before.
7. **Public profile leak fix** — visiting `/guides/<slug-of-unverified-guide>` returns 404 (verified separately in this same session).

## Open follow-ups

- **Resend verification email** — the "Resend it" link on `/register` step 2 currently shows an alert. Wire it to a real `/auth/resend-verification` endpoint (idempotent, rate-limited).
- **Verify-email idempotency UX** — second click on the link currently re-mints tokens silently. Consider showing "you're already verified, redirecting…" if `existingRoles.length > 0`.
- **Pre-existing unverified users** — provide an admin-side "force verify" button so support can rescue stuck accounts without a SQL update.
