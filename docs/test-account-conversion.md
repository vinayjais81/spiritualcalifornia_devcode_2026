# Test-account conversion (pre-launch onboarding)

## Why this exists

Before public launch, admin needs to seed the platform with real guide
profiles — bios, services, products, events, tours, blog posts — so the
marketplace doesn't open empty. The catch: at the time we're seeding, we
**don't have the real guides' email addresses yet**. We get those later,
sometimes weeks later, as the guides come on board.

This document describes the workflow that lets admin self-register guides
now using throwaway emails, then atomically swap each one for the real
email when it arrives and hand the account off to the actual guide.

## End-to-end flow

1. **Admin registers the guide.** Admin walks through the normal public
   guide onboarding wizard using a throwaway email on a configured test
   domain — default `@scprelaunch.test` (RFC-reserved `.test` TLD, can't
   accidentally route real mail; overridable via
   `TEST_ACCOUNT_EMAIL_DOMAIN`). The auth layer auto-flags the row with
   `User.isTestAccount = true` (see `AuthService.isTestDomainEmail`).
   The wizard, profile-build, credential upload, payment-account
   onboarding, and content creation all proceed identically to a real
   guide signup.

2. **Real email arrives.** Admin pastes the real email into the
   `/admin/guides` row's **Convert** action. Backend
   (`PATCH /admin/users/:id/convert-test-account`):
   - Verifies `User.isTestAccount = true` (defense-in-depth — without
     this guard, the action could rewrite a real user's email).
   - Verifies the target isn't ADMIN/SUPER_ADMIN.
   - Swaps `email` → the real address.
   - Nulls `passwordHash` so the throwaway password stops working
     immediately.
   - Mints a one-time claim token (reuses `emailVerifyToken`, 24h TTL).
   - Revokes every active refresh token on the row.
   - Writes an `AuditLog` row capturing actor + old email + new email.
   - Fires the **Guide Claim Invite** email
     (`EmailService.sendGuideClaimInvite`) to the new address. The
     `sendInvite=false` toggle exists for cases where admin wants to
     swap the email silently and send the invite later.

3. **Guide claims the account.** The invite link
   (`/guide/claim?token=…`) lands on a public page that asks for a
   password and submits to `POST /auth/claim-account`. Backend
   (`AuthService.claimAccount`) verifies the email, sets the chosen
   password, and mints an access/refresh session — same end state as
   the normal `/verify-email` → `/login` pair, collapsed into one
   round-trip.

4. **`isTestAccount` stays true** as a historical marker so admin can
   see which accounts were spun up via the pre-launch process. The
   workflow's active gate is the password being non-null after claim,
   not the flag.

## Safety rails

- Auto-flag is **opt-in by domain**: only emails ending in the
  configured test domain get the flag at register time. Real users
  on real domains are never flagged.
- Convert is **gated on `isTestAccount`** server-side; the admin UI
  also hides the button on rows that aren't flagged.
- Convert **cannot target ADMIN / SUPER_ADMIN** rows or the actor's
  own account.
- The old throwaway email + password go dead **the instant the swap
  lands** (no grace period). Anyone holding the old creds is locked
  out immediately.
- Refresh tokens are revoked at swap-time too so a logged-in session
  on the throwaway account can't survive the conversion.
- The claim endpoint **only accepts tokens belonging to test
  accounts**. A real user with a stray `emailVerifyToken` is sent
  down `/verify-email` or `/reset-password` instead.
- Every action writes to `AuditLog` (`admin.user.convertTestAccount`,
  `admin.user.resendClaimInvite`, `admin.user.setTestAccountFlag`).

## Operations: stuck or expired invite

If the original invite bounced or the 24h token expired before the
guide clicked through, admin hits the **Resend invite** button on the
`/admin/guides` row. Endpoint
(`POST /admin/users/:id/resend-claim-invite`) rotates the token so any
in-flight link goes dead, then re-emails the current address. The
guide row already has the real email at this point — the only thing
being rotated is the token.

## Backfill

For accounts registered before this feature shipped (or for the rare
case where admin needs to demote a real account back to "test" before
deletion), `PATCH /admin/users/:id/test-account-flag` lets admin
toggle `User.isTestAccount` manually. Audit-logged. Admin / super-admin
targets are still rejected.

## Schema

One column added (`migrations/20260521120000_test_account_marker`):

```sql
ALTER TABLE "users" ADD COLUMN "isTestAccount" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "users_isTestAccount_idx" ON "users"("isTestAccount");
```

## Config

| Variable | Default | Purpose |
| --- | --- | --- |
| `TEST_ACCOUNT_EMAIL_DOMAIN` | `scprelaunch.test` | Bare domain to match at register time. Emails ending in `@<this>` get `isTestAccount=true`. |
