# Guide Deferred Onboarding

**Shipped:** 2026-04-28
**Owner:** Guide UX
**Companion:** mirrors [seeker-deferred-onboarding.md](./seeker-deferred-onboarding.md) for the GUIDE role

## Problem

The guide registration wizard has 7 visual steps (Profile, Services, Credentials, Identity, Calendar, Products, Go Live). Any guide who closed the tab mid-flow was forced back to the wizard on every login until they finished everything — including credential uploads and verification submission. That's heavy. Guides who'd verified their email but bailed during step 3+ were trapped in a flow they could only exit by completing it.

## What changed

The threshold for "registered" is now **email verified** (same as seekers). Email-verified guides land on `/guide/dashboard` instead of being redirected back to the wizard, and a `GuideProfileCompletenessWidget` nudges them to fill the remaining wizard sections piecemeal from the dashboard sub-pages.

### Backend

- New helper [`GuidesService.computeProfileCompleteness`](../Backend/api/src/modules/guides/guides.service.ts) — five equally-weighted sections, 20% each:

  | Key | Label | Filled when |
  |-----|-------|-------------|
  | `categories` | Categories | ≥1 GuideCategory row |
  | `profile` | Profile basics | `bio` non-empty AND `User.avatarUrl` set |
  | `locationSchedule` | Location & schedule | `location` set OR `calendlyConnected` true |
  | `credentials` | Credentials | ≥1 Credential row |
  | `submittedForVerification` | Submitted for verification | `verificationStatus IN ('IN_REVIEW','APPROVED')` |

- [`GET /guides/me`](../Backend/api/src/modules/guides/guides.controller.ts) now returns a `completeness` block (sections, filledCount, totalSections, percent, isComplete) — same shape as the seeker version.
- [`GET /guides/onboarding/status`](../Backend/api/src/modules/guides/guides.controller.ts) gained two fields:
  - `isEmailVerified: boolean` — even when no GuideProfile exists yet, surfaced from the User row.
  - `completeness` — same block as `/guides/me`, populated when the GuideProfile exists.

### Frontend

- [`OnboardingWizard`](../Frontend/web/src/components/onboarding/OnboardingWizard.tsx) on mount calls `/guides/onboarding/status`. If `isEmailVerified === true` and the URL doesn't have `?resume=1`, it `router.replace('/guide/dashboard')`. Guides who explicitly want the linear wizard back can navigate to `/onboarding/guide?resume=1` from the widget's "Resume guided setup →" link.
- [`/onboarding/guide/page.tsx`](../Frontend/web/src/app/onboarding/guide/page.tsx) wraps the wizard in `<Suspense>` so `useSearchParams()` doesn't break static prerender.
- New [`GuideProfileCompletenessWidget`](../Frontend/web/src/components/guide/GuideProfileCompletenessWidget.tsx):
  - Same visual language as the seeker widget for consistency.
  - "Continue Setup" CTA points at the **first missing section's dashboard sub-page**, not a single profile page (because guide sections live across `profile`, `location`, `verification`).
  - Section chips are clickable links — green-check (filled) or golden-circle (to-do) — each routing to the relevant sub-page.
  - "Resume guided setup →" link to `/onboarding/guide?resume=1` for guides who prefer the linear flow.
- [`/guide/dashboard`](../Frontend/web/src/app/guide/dashboard/page.tsx) renders the widget right under the `PageHeader`.

### Section → sub-page routing

| Section key | Sub-page |
|-------------|----------|
| `categories` | `/guide/dashboard/profile` |
| `profile` | `/guide/dashboard/profile` |
| `locationSchedule` | `/guide/dashboard/location` |
| `credentials` | `/guide/dashboard/verification` |
| `submittedForVerification` | `/guide/dashboard/verification` (Submit button) |

## Important non-changes — what stayed the same

- **Public visibility is untouched.** Guides only appear on `/practitioners` when `isPublished AND isVerified` — same gate as before. The new widget exists to *help guides reach that gate*; it doesn't bypass it. A guide with email verified but no categories/credentials still won't be listed publicly, can't accept bookings (no services to book), and won't appear in Algolia (no `algoliaObjectId` until verification approval).
- **Verification pipeline is untouched.** The submit-for-verification step still flips `verificationStatus` from `PENDING → IN_REVIEW`, the admin queue still picks it up, the Persona + Textract + Claude chain still runs.
- **Stripe Connect is intentionally NOT a section.** It's a separate post-approval lifecycle stage handled by its own prompt on `/guide/dashboard/earnings`. Folding it into the 5-section widget would conflate "complete your profile" (pre-verification) with "set up payouts" (post-approval) and make 16.66%-per-section maths.
- **The wizard itself is unchanged.** Guides who hit `/onboarding/guide?resume=1` get exactly the same 7-step flow as before. The wizard's steps are still authoritative for the data they capture; the dashboard sub-pages share the same backend endpoints.

## Backfill

**None needed.** Unlike `SeekerProfile`, `GuideProfile` doesn't have an `onboardingCompleted` flag — wizard step tracking lives client-side in the Zustand `onboarding.store`. The new redirect logic on `/onboarding/guide` reads `isEmailVerified` directly from the user row. Existing email-verified guides are *automatically released* the moment this ships, with no SQL update.

The completeness widget reads its 5 sections from existing schema columns (`bio`, `User.avatarUrl`, `categories[]`, `credentials[]`, `verificationStatus`) — so it works retroactively for every guide in the DB.

## States the UX handles

| User state | What `/onboarding/guide` does | Where the widget shows |
|---|---|---|
| Unauthenticated | Step 1 form (account creation embedded in wizard) | n/a |
| Authenticated, email NOT verified | Resume wizard at the appropriate step | n/a |
| Authenticated, email verified, completeness <100% | Redirect to `/guide/dashboard` (unless `?resume=1`) | Yes, on dashboard |
| Authenticated, email verified, `?resume=1` set | Wizard renders, resumes at completed-steps boundary | Yes (still useful — verification might not be submitted) |
| Authenticated, email verified, completeness 100% | Redirect to `/guide/dashboard` | No (auto-hides) |

## Verification checklist (post-deploy)

1. **Wizard redirect.** Sign in as a guide with `isEmailVerified=true` and visit `/onboarding/guide`. Should bounce to `/guide/dashboard` immediately.
2. **Widget visible.** Same guide should see "Your profile is N% complete" widget at the top of the dashboard with the right N.
3. **Widget routes.** Click the "Categories" chip → lands on `/guide/dashboard/profile`. Click "Credentials" chip → lands on `/guide/dashboard/verification`.
4. **Resume escape.** Click "Resume guided setup →" → goes to `/onboarding/guide?resume=1` and the linear wizard renders (no redirect bounce).
5. **Auto-hide at 100%.** Submit for verification (5/5 sections filled) → reload dashboard → widget gone.
6. **Public visibility unchanged.** Same guide does NOT appear on `/practitioners` until `isPublished=true AND isVerified=true` (i.e. admin approval).
7. **No SQL backfill needed.** No migration was added — `prisma migrate status` shows the same set as before this change.

## Cross-cutting parity with seekers

| Concept | Seeker | Guide |
|---|---|---|
| Login threshold | `isEmailVerified` | `isEmailVerified` |
| Wizard redirect | `/register` → `/seeker/dashboard` | `/onboarding/guide` → `/guide/dashboard` |
| Resume escape | (none — wizard auto-completes once verified) | `?resume=1` |
| Completeness sections | 5 × 20% | 5 × 20% |
| Where to fill | Single page (`/seeker/dashboard/profile`) | Multiple sub-pages (profile / location / verification) |
| Backfill needed | Yes — flip `onboardingCompleted=true` for verified seekers | No — derived from existing schema |
| Public visibility gate | n/a (seekers are always private) | `isPublished AND isVerified` (unchanged) |
