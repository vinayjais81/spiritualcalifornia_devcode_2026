# Seeker Deferred Onboarding

**Shipped:** 2026-04-28
**Owner:** Seeker UX
**Replaces:** the legacy "must finish all 5 wizard steps before using the site" flow

## Problem

The seeker registration wizard had 5 steps:

1. **Create Account** — name, email, password (form submit creates the user)
2. **Verify Email** — out-of-band: user clicks the link emailed to them
3. **Your Interests** — multi-select chips
4. **Experience** — level (beginner / explorer / practitioner / teacher) + practices array
5. **Your Journey** — free-text "what brings you here"

Steps 3–5 are valuable for matching but **not load-bearing for using the site**. Yet the wizard treated them as required: any seeker who closed the tab before finishing was forced back through the remaining steps on every login until the wizard called `/seekers/onboarding/step` with `completed: true`.

This caused real abandon: users who'd already verified their email saw the wizard again, decided they didn't want to fill it in right now, and bounced.

## What changed

The threshold for "registered" is now **email verified**, not "wizard completed." Wizard steps 3–5 become deferred profile fields surfaced from the dashboard.

### Backend

- New columns on `SeekerProfile`:
  - `experienceLevel String?`
  - `practices String[] @default([])`
  - `journeyText String?`
- Migration [`20260428000000_seeker_profile_journey_fields`](../Backend/api/prisma/migrations/20260428000000_seeker_profile_journey_fields/migration.sql) creates the columns AND backfills `onboardingCompleted = TRUE` for any seeker whose `User.isEmailVerified = TRUE`. Existing stuck users are released on first deploy.
- [`SeekersService.getOnboardingStatus`](../Backend/api/src/modules/seekers/seekers.service.ts) now returns `{ step, completed, isEmailVerified }` and reports `completed: true` whenever email is verified — even if the stored `onboardingCompleted` flag is still false.
- [`SeekersService.computeProfileCompleteness`](../Backend/api/src/modules/seekers/seekers.service.ts) — five equally-weighted sections (`bio`, `interests`, `experienceLevel`, `practices`, `journeyText`), 20% each. Returned as a `completeness` block on `GET /seekers/me`. Bio is the only legacy field included; phone/location are excluded because they don't change matching quality.
- [`PATCH /seekers/me`](../Backend/api/src/modules/seekers/seekers.controller.ts) now accepts the three new fields with `null`-clears-the-column semantics.

### Frontend

- [`/register`](../Frontend/web/src/app/register/page.tsx) on mount checks `/seekers/onboarding/status`. If `completed || isEmailVerified` → `router.replace('/seeker/dashboard')`. Same logic for both Google and email registration paths.
- [`/verify-email`](../Frontend/web/src/app/verify-email/page.tsx) success countdown now redirects to `/seeker/dashboard` instead of `/`. Users land where they can act.
- [`/seeker/dashboard/profile`](../Frontend/web/src/app/seeker/dashboard/profile/page.tsx) gains a "Your Practice" panel:
  - Experience-level cards (4 options, click again to deselect).
  - Practices chip multi-select (12 options matching the wizard).
  - "What brings you here?" textarea.
  - In-page completeness banner with mini progress bar (only when <100%).
- New component [`ProfileCompletenessWidget`](../Frontend/web/src/components/seeker/ProfileCompletenessWidget.tsx) on `/seeker/dashboard`:
  - Headline `Your profile is N% complete`.
  - Progress bar.
  - Section chips with green-check (filled) / golden-circle (to-do) states.
  - "Complete Profile" CTA → profile page.
  - Self-hides at 100%.

### What stays the same

- The wizard itself still works for users mid-flow with **unverified email**. They see the "Check your inbox + pick interests" hybrid step 2 screen so they have something to do while waiting for the email link.
- New seekers who come in fresh still see step 1 (Create Account) at `/register` as before.
- `POST /seekers/onboarding/step` and the `onboardingStep` / `onboardingCompleted` columns are unchanged for backward compatibility.

## Completeness math

The five sections of profile completeness, in priority order:

| Key | Source | Filled when |
|-----|--------|-------------|
| `interests` | `SeekerProfile.interests[]` | array length > 0 |
| `experienceLevel` | `SeekerProfile.experienceLevel` | non-null |
| `practices` | `SeekerProfile.practices[]` | array length > 0 |
| `journeyText` | `SeekerProfile.journeyText` | non-empty trimmed string |
| `bio` | `SeekerProfile.bio` | non-empty trimmed string |

Each section is worth 20%. `phone` and `location` are intentionally **excluded** — they're optional everywhere else and don't shape matching quality. Including them would mean perpetually-90% profiles for users who never set them, which trains people to ignore the widget.

## States the UX handles

| User state | What `/register` does | Where the widget shows |
|---|---|---|
| Unauthenticated | Step 1 form | n/a |
| Authenticated, email NOT verified | Resume wizard at step 2 (Check inbox + interests) | n/a (not on dashboard) |
| Authenticated, email verified, profile <100% | Redirect to `/seeker/dashboard` | Yes, on dashboard + small banner on profile page |
| Authenticated, email verified, profile 100% | Redirect to `/seeker/dashboard` | No (auto-hides) |

## Backfill on existing data

The migration's `UPDATE` statement is idempotent and gated on:

```sql
WHERE sp."onboardingCompleted" = FALSE
  AND u."isEmailVerified" = TRUE
```

So:
- Re-running it is a no-op (the rows it would touch are already `TRUE`).
- It never touches users who haven't verified email.
- It runs as part of `prisma migrate deploy` in the standard deploy pipeline — no separate seed step needed.

## What's deliberately deferred

- **Interest list source.** The wizard's `ALL_INTERESTS` array is still hardcoded (24 modalities). The audit's `[register/page.tsx:25-58]` P2 item to derive these from `/guides/categories` is unchanged by this work.
- **Phone capture in profile.** Today's profile page doesn't have a phone field; phone only gets captured if the user typed it during step 1. Adding phone editing here is a separate one-line follow-up if needed.
- **AI re-prompting on the dashboard.** The `journeyText` field exists; whether the AI guide chatbot uses it for matching is a separate AI-prompt-engineering task.

## Verification checklist (post-deploy)

1. Migration applied — `\d seeker_profiles` shows `experienceLevel`, `practices`, `journeyText` columns.
2. Backfill ran — seekers with `users.isEmailVerified = TRUE` AND `seeker_profiles.onboardingCompleted = TRUE` should match. Spot-check a known stuck account.
3. Stuck user free — log in as a previously-stuck seeker; should land on dashboard, not `/register`.
4. Widget visible — newly-verified seeker sees the "Your profile is N% complete" widget on first dashboard load.
5. Widget hides at 100% — fill all 5 sections via `/seeker/dashboard/profile`, save, reload dashboard, widget gone.
6. Wizard still works for genuinely new users — register fresh email, before clicking the verify link the wizard's step 2 still loads with the "Check your inbox" notice.
