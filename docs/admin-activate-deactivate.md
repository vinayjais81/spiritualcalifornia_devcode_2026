# Admin: Activate / Deactivate User Accounts

**Status:** Shipped 2026-05-19 (client requirement)
**Migration:** `20260519100000_deactivate_replaces_ban_and_archive`
**Surface:** `/admin/users` → **Deactivate** / **Activate** button on every row
**Endpoints:** `PATCH /admin/users/:id/deactivate`, `PATCH /admin/users/:id/activate`

## Why

Replaces two earlier mechanisms — Ban and Archive — with a single
neutral Activate/Deactivate toggle that works for any user (SEEKER, GUIDE,
ADMIN, SUPER_ADMIN) at any verification status.

The old `isBanned` field is gone; `User.isActive` is now the single
source of truth for "can this account log in and be surfaced
publicly." The pending-guide Archive flow shipped on 2026-05-18 is
removed in this PR — Deactivate replaces it for every use case the
client cares about.

## Safety rails

| Rail | Where enforced |
|------|----------------|
| `reason` required (≥3 chars) on Deactivate | `DeactivateUserDto` |
| Cannot deactivate your own account | Service `actor.id === targetUserId` check |
| ADMIN cannot toggle another ADMIN/SUPER_ADMIN | Service `targetIsAdminish && !actorIsSuperAdmin` check |
| All active refresh tokens revoked on deactivate | Same transaction as the User.isActive flip |
| Audit log row written | `audit_logs.action = 'admin.user.deactivate'` / `'admin.user.activate'` |
| Authorization via existing JwtAuthGuard + RolesGuard | Inherited from `AdminController` class decorators |

## What Deactivate does

- Sets `User.isActive = false`, stamps `deactivatedAt / deactivatedReason / deactivatedBy`.
- Login blocked: `auth.service.login` and `jwt.strategy.validate` both
  reject inactive accounts with *"Your account has been deactivated.
  Please contact support to reactivate."*
- Public guide profile (`/guides/[slug]`) returns 404 if the underlying
  `user.isActive` is false.
- Public listings filter the guide out: practitioners listing, home
  page featured strip, AI matcher, events listing, tours listing,
  products listing — all gated on `guide.user.isActive: true`.
- Active refresh tokens revoked → any live sessions die at their next API
  call.

## What Deactivate does **NOT** do

These are deliberate per the design discussion:

- **Does not free the email.** A deactivated account keeps its email
  bound. If the same person needs to come back, an admin reactivates
  rather than letting them re-register. The DB unique constraint on
  `users.email` still holds.
- **Does not cancel bookings, refund payments, or freeze payouts.**
  Money flows continue. Existing seekers who already booked still see
  what they paid for. Stripe payouts clear on their normal cycle.
- **Does not send an email** to the affected user. Mirrors the previous
  Ban behaviour. Can be added later if support asks for it.
- **Does not auto-reactivate.** Reactivation is purely admin-driven.

## Migration notes (one-time)

The `20260519100000_deactivate_replaces_ban_and_archive` migration:

1. Adds `deactivatedAt`, `deactivatedReason`, `deactivatedBy` to `users`.
2. Copies every `isBanned = true` row into the new shape:
   `isActive = false`, `deactivatedAt = NOW()`,
   `deactivatedReason = COALESCE(bannedReason, 'Migrated from banned status')`.
3. Drops `users.isBanned` and `users.bannedReason`.
4. Drops the archive feature shipped yesterday:
   - `users.archivedAt`
   - `guide_profiles.archivedAt / archivedBy / archivedReason`
   - `archived_guide_registrations` table

No production data existed under the archive feature — only dev test rows.

## Audit lookup

```sql
SELECT * FROM audit_logs
WHERE action IN ('admin.user.deactivate', 'admin.user.activate')
ORDER BY "createdAt" DESC;
```

`userId` is the admin who triggered the toggle; `entityId` is the
affected user; `newValue.reason`, `targetEmail`, `actorEmail` are stored
on the row.

## Files touched

- `Backend/api/prisma/schema.prisma` — drop archive schema, drop
  isBanned/bannedReason, add deactivation columns.
- `Backend/api/prisma/migrations/20260519100000_deactivate_replaces_ban_and_archive/migration.sql`
- `Backend/api/src/modules/admin/admin.service.ts` — `deactivateUser`,
  `activateUser` (replaces `banUser`, `unbanUser`); archive methods
  removed.
- `Backend/api/src/modules/admin/admin.controller.ts` — new endpoints,
  archive endpoints removed.
- `Backend/api/src/modules/admin/dto/deactivate-user.dto.ts` — replaces
  `ban-user.dto.ts`.
- `Backend/api/src/modules/admin/admin.module.ts` — drop
  `ArchiveCleanupQueue` provider.
- `Backend/api/src/modules/admin/archive-cleanup.queue.ts` — deleted.
- `Backend/api/src/modules/auth/auth.service.ts` — login gate uses
  `isActive` only; new error copy.
- `Backend/api/src/modules/auth/strategies/jwt.strategy.ts` — same.
- `Backend/api/src/modules/users/users.service.ts` — `update()`
  signature swaps `isBanned/bannedReason` → `deactivatedAt/Reason/By`.
- `Backend/api/src/modules/guides/guides.service.ts` — public profile
  + listings + featured + filler queries gate on `user.isActive`.
- `Backend/api/src/modules/home/home.service.ts` — featured guides gate.
- `Backend/api/src/modules/ai/ai.service.ts` — practitioner matcher gate.
- `Backend/api/src/modules/events/events.service.ts` — public listing +
  `findOne` gate.
- `Backend/api/src/modules/soul-tours/soul-tours.service.ts` — public
  listing + `findOne` + stats gate.
- `Backend/api/src/modules/products/products.service.ts` — public
  listing + `findOne` gate.
- `Backend/api/src/config/env.validation.ts` — drop
  `ARCHIVE_CLEANUP_ENABLED`.
- `Frontend/web/src/app/(admin)/users/page.tsx` — Deactivate/Activate
  buttons, modal, status badge changes.
- `Frontend/web/src/app/(admin)/guides/page.tsx` — archive Remove button
  + modal removed.
- `docs/admin-archive-pending-guides.md` — deleted.
