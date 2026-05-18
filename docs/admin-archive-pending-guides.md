# Admin: Archive Pending Guide Registrations

**Status:** Shipped 2026-05-18
**Migration:** `20260518120000_archive_pending_guides`
**Surface:** `/admin/guides` (Pending tab) → "Remove" button

## Why

Two recurring operational problems weren't solvable inside the existing
APPROVED / PENDING / IN_REVIEW / REJECTED workflow:

1. **Spam and abandoned signups** clutter the verification queue. There was
   no way for admins to clear them.
2. **A "pending guide" tombstone blocks re-registration.** Because of the
   [seeker/guide role mutex](./seeker-guide-role-mutex.md), an email that
   ever attempted guide registration is locked out of registering as a
   seeker — even if the user gave up halfway through onboarding.

A hard delete would orphan three pieces of external state:
- The Stripe Connect Express account (if onboarding was started).
- S3 credential documents and the avatar image.
- The Persona inquiry, if one was created.

It would also destroy the audit trail, making repeat-offender detection
impossible.

## Solution shape

Soft-delete with a 90-day grace window, plus a single audit row that
outlives the User.

### Archive flow (immediate)

1. Admin opens `/admin/guides`, filters or scrolls to a PENDING row,
   clicks the red **Remove** button.
2. Modal asks for a free-text reason (required, ≥3 chars).
3. `POST /admin/guides/:guideId/archive` with `{ reason }` runs a single
   transaction:
   - `GuideProfile`: stamps `archivedAt` / `archivedBy` / `archivedReason`,
     forces `isPublished=false`, `isVerified=false`.
   - `User`: stamps `archivedAt`, sets `isActive=false`, and **renames
     `email`** to `${original}.archived.${userId}@scarchive.local`. The
     suffix is unique-by-userId so the unique constraint can't collide.
   - `UserRole`: deletes the `GUIDE` row so the role mutex frees up.
   - `ArchivedGuideRegistration`: writes an audit row capturing
     `originalEmail`, `displayName`, Stripe account ID, S3 keys for every
     credential document, S3 key for the avatar, Persona inquiry ID, the
     reason, and `archivedBy`.

External resources (Stripe / S3 / Persona) are **not** touched at this
step. The audit row's S3 keys + Stripe account ID are the breadcrumbs the
cleanup cron needs later.

### Hard delete (cron, +90 days)

`ArchiveCleanupQueue` runs `0 3 * * *` daily. For every
`ArchivedGuideRegistration` with `archivedAt < now - 90d` and
`hardDeletedAt = null`:

1. **Stripe:** `accounts.del()` → falls back to `accounts.reject()` for
   Express accounts that can't be deleted. Final error is logged into
   `hardDeleteNotes` and the row continues.
2. **S3:** `DeleteObjects` batch for every credential key + the avatar.
3. **Database:** `prisma.user.delete()` — Prisma cascades wipe
   `GuideProfile`, `Credential`, `CredentialVerification`,
   `PersonaVerification` (via `userId` FK), `UserRole`, `RefreshToken`,
   etc.
4. **Audit row:** stamps `hardDeletedAt`, records the cascade notes,
   nulls out `userId` / `guideProfileId` (their targets no longer exist).
   The audit row itself is kept forever — it's the moderation breadcrumb.

The cron is bounded to 200 rows per run so a backfill never starves
other queues. Per-row failures are logged but don't poison the batch.

Manual escalation:
`POST /admin/guides/cleanup-archived` runs the same logic on demand.

## Gate: pending only

`archivePendingGuide` rejects anything that isn't `PENDING`. IN_REVIEW
goes through `reject` (which keeps the paper trail visible).
APPROVED guides must never be archived this way — banning, unfeaturing,
or unpublishing are the right tools for those.

## Re-registration after archive

A user whose pending registration was archived:
- can immediately register again under the same email — the suffix-rename
  releases the unique constraint on `users.email`.
- can register as a seeker (mutex is satisfied: the GUIDE role row was
  deleted).
- shows up in `archived_guide_registrations` by `originalEmail` if
  moderation wants to flag the repeat attempt.

## What is NOT supported

- **Un-archive.** The flow is one-way until the 90-day window expires
  and the cron runs. If an admin misclicks, a database row update on
  the archived registration can restore it, but there's no UI for that
  yet. The 90-day window is the safety net.
- **Archiving from other statuses.** IN_REVIEW, FLAGGED, APPROVED, and
  REJECTED can't be archived. Use the existing reject / ban paths.
- **Bulk archive.** One row per click. If volume becomes a problem we'll
  add a bulk action.

## Files touched

- `Backend/api/prisma/schema.prisma` — `User.archivedAt`,
  `GuideProfile.archivedAt/By/Reason`, new
  `ArchivedGuideRegistration` model.
- `Backend/api/prisma/migrations/20260518120000_archive_pending_guides/migration.sql`
- `Backend/api/src/modules/admin/admin.service.ts` —
  `archivePendingGuide`, `hardDeleteExpiredArchivedGuides`, archived
  filter on `getGuides` and `getVerificationQueue`.
- `Backend/api/src/modules/admin/admin.controller.ts` —
  `POST /admin/guides/:guideId/archive`,
  `POST /admin/guides/cleanup-archived`.
- `Backend/api/src/modules/admin/admin.module.ts` — registers
  `ArchiveCleanupQueue`.
- `Backend/api/src/modules/admin/archive-cleanup.queue.ts` — new daily
  cron worker.
- `Backend/api/src/modules/payments/stripe.service.ts` —
  `deleteOrRejectConnectAccount` helper.
- `Backend/api/src/modules/upload/upload.service.ts` — `deleteObjects`
  and `extractS3Key` helpers.
- `Backend/api/src/config/env.validation.ts` — registers optional
  `ARCHIVE_CLEANUP_ENABLED` and `TOUR_TASKS_ENABLED` toggles.
- `Frontend/web/src/app/(admin)/guides/page.tsx` — Remove button +
  confirm modal + mutation.

## Env

- `ARCHIVE_CLEANUP_ENABLED` (optional, default true). Set to `false`
  in environments without Redis to suppress the cron startup warning.
