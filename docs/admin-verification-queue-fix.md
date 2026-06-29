# Admin: Verification Queue Shows IN_REVIEW Guides

**Status:** Shipped 2026-06-29 (bug fix)
**Surface:** Admin → **Verification** queue (`/admin/verification`)
**Endpoint:** `GET /admin/verification` → `AdminService.getVerificationQueue`
**Companion fix in same session:** public-profile event Register button (see git `3c66fcb`)

## Symptom

A practitioner (`lallanasvetlana+33@gmail.com`, "Invte 22 Practitioner 22")
was:

- **Active** in the admin Users list (`User.isActive = true`),
- able to connect Stripe and **publish events / sessions**,
- showing a blue **"In Review"** badge in the admin Guides list,

…yet her public profile at `/guides/<slug>` returned **"Guide not found"**,
and **her name never appeared in the admin Verification approval queue**, so
an admin could not approve her.

## Root cause

The public profile gate ([guides.service.ts](../Backend/api/src/modules/guides/guides.service.ts)
`getPublicProfile`) requires **all** of `isVerified && isPublished &&
user.isActive`. Both `isVerified` and `isPublished` only flip to `true` when
an admin **approves** the guide via `VerificationService.reviewGuide('approve')`.

Approval was impossible because the queue that *lists* guides and the action
that *approves* them disagreed on which statuses count:

| Function | Status filter | File |
|----------|---------------|------|
| `getVerificationQueue` (lists guides for approval) | `PENDING` **only** *(before fix)* | `admin.service.ts` |
| `approveGuide` (the approve action) | accepts `PENDING` **or** `IN_REVIEW` | `admin.service.ts` |

Her `verificationStatus` was **`IN_REVIEW`** (set when a guide submits for
review — `guides.service.ts` `submitForReview` → `verificationStatus =
IN_REVIEW`). Because the listing query excluded `IN_REVIEW`, she was stranded:

```
IN_REVIEW guide → not listed in queue → admin can't click Approve
  → isVerified never set → public profile permanently 404
```

This stranding became reachable because of the **deferred onboarding** flow:
email-verified guides skip the wizard and reach `IN_REVIEW` outside the
original PENDING-only assumption the queue was written against.

## Fix

Align the listing filter with what `approveGuide` already accepts — surface
both statuses:

```ts
// admin.service.ts → getVerificationQueue
const queueWhere = {
  verificationStatus: {
    in: [VerificationStatus.PENDING, VerificationStatus.IN_REVIEW],
  },
};
```

One-line, low-risk; no schema/migration change. `approveGuide` already
guarded `PENDING || IN_REVIEW`, so no change was needed there.

Commit: `aaaa592` (`fix(admin): show IN_REVIEW guides in verification approval queue`).

## Effect

- All guides in `IN_REVIEW` now appear in the admin Verification queue and can
  be approved. Approving sets `isVerified = isPublished = true`, the
  "approved" email goes out, and the public profile renders immediately.
- Pre-existing `IN_REVIEW` guides (previously invisible) will now appear in the
  queue — expect a few extra pending approvals to surface after deploy.

## Related / follow-ups

- **Orphaned legacy queue:** `GET /verification/queue`
  (`VerificationService.getPendingReviews`, filters `IN_REVIEW`) is **not**
  called by the admin UI (which uses `GET /admin/verification`). Candidate for
  removal to avoid future confusion. Not removed in this fix.
- Public visibility gate (`isVerified AND isPublished AND user.isActive`) is
  unchanged — see [admin-activate-deactivate.md](./admin-activate-deactivate.md)
  and the guide-deferred-onboarding notes.
- Possible UX hardening (not done): warn the guide on the dashboard that their
  profile stays hidden until verification is approved, and/or gate
  offering-publish on verification.
