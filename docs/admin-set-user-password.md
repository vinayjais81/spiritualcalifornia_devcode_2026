# Admin: Set User Password Directly

**Status:** Shipped 2026-05-18
**Surface:** `/admin/users` → "Reset password" button on every row
**Endpoint:** `POST /admin/users/:id/password`

## Why

Support tickets and emergency lockouts sometimes require an admin to put a
working password on a user account immediately — when the user's email is
inaccessible, when the reset-link delivery is failing, or during incident
response. This endpoint covers that case directly rather than forcing
admins to trigger a reset email and wait.

Direct-set is more powerful than the user-facing reset-link flow and
correspondingly more dangerous, so it's gated by several rails. If you
just need to nudge a user to reset their password, use a normal
"forgot password" trigger instead — this endpoint is for the cases where
that doesn't work.

## Safety rails

| Rail | Where enforced |
|------|----------------|
| Password meets full strength policy (10–128 chars, mixed case, digit, special, deny-list) | `SetUserPasswordDto` via `@IsStrongPassword` (DTO) + `checkPasswordPolicy` (service, defense-in-depth) |
| Password does not contain the **target's** name or email | `admin.service.setUserPassword` (DTO can't see the target user) |
| Nobody can reset their own password via this endpoint | Service rejects when `actor.id === targetUserId` |
| ADMIN cannot reset another ADMIN/SUPER_ADMIN — only SUPER_ADMIN can | Service `targetIsAdminish && !actorIsSuperAdmin` check |
| All active refresh tokens revoked | Same transaction as the password update |
| Any in-flight password-reset tokens cleared | Same transaction |
| Audit log row recorded with actor, reason, target email | `AuditLog.action = 'admin.password.set'` |
| Affected user emailed automatically | `EmailService.sendAdminPasswordChange` |
| Authorization via existing JwtAuthGuard + RolesGuard | Inherited from `AdminController` class decorators |

The DTO requires `reason` (min 3 chars). The UI hides the submit button
until both the password passes every rule and the reason is filled in.

## Flow

1. Admin opens `/admin/users`, finds the row, clicks **Reset password**.
2. Modal shows the user's name + email. Admin types a new password — the
   `PasswordStrengthMeter` reuses the seeker/guide signup component and
   personalises the deny-list with this user's name/email.
3. Admin types a reason (≥3 chars). The submit button stays disabled
   until all strength rules pass.
4. `POST /admin/users/:id/password` with `{ newPassword, reason }`:
   - re-validates the password,
   - role-gates the action,
   - hashes with bcrypt (cost 12, same as registration),
   - in a single transaction: updates `passwordHash`, clears any
     `passwordResetToken`/`passwordResetExpiry`, revokes every
     non-revoked refresh token, writes an `AuditLog` row,
   - sends the user a notification email (failures don't roll back —
     `EmailService.send` swallows errors).
5. Response: `{ userId, passwordChangedAt, sessionsRevoked: true }`.

## What this does NOT do

- **Send a reset link.** This endpoint sets the password directly. If you
  want the user-driven flow, use the existing `/auth/forgot-password`
  route instead.
- **"Force change on next login."** Not implemented yet. If you need this
  behaviour, add a `mustResetPassword` flag on `User` and gate the login
  response on it — straightforward follow-up if support actually asks
  for it.
- **Show the password back to the admin.** The Eye / EyeOff toggle on
  the input is the only way to see it — never persisted, never logged.

## Files

- `Backend/api/prisma/schema.prisma` — no schema changes (existing
  `AuditLog` is used).
- `Backend/api/src/modules/admin/dto/set-user-password.dto.ts` — DTO with
  strength + reason validators.
- `Backend/api/src/modules/admin/admin.service.ts` — `setUserPassword`
  method (~80 lines incl. comments).
- `Backend/api/src/modules/admin/admin.controller.ts` —
  `POST /admin/users/:id/password`.
- `Backend/api/src/modules/notifications/email.service.ts` —
  `sendAdminPasswordChange` template.
- `Frontend/web/src/app/(admin)/users/page.tsx` — Reset password button +
  modal with strength meter + show/hide toggle.

## Audit lookup

```sql
SELECT * FROM audit_logs
WHERE action = 'admin.password.set'
ORDER BY "createdAt" DESC;
```

`userId` is the admin who triggered the reset; `entityId` is the affected
user; `newValue.reason`, `targetEmail`, and `actorEmail` are stored on the
row.
