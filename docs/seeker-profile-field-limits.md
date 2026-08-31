# Seeker Profile Field Limits

Adds enforced, visible character limits to the seeker profile's free-text
fields (`/seeker/dashboard/profile`).

Fixes the QA defect *"No character-limit guidance on profile Bio / Interests
fields"* (severity: minor) —
[SpiritualCalifornia-playwright-testing#6](https://github.com/SvetlanaZap/SpiritualCalifornia-playwright-testing/issues/6).

## The defect

A ~2,800-character Bio and an Interests value of Cyrillic + emoji + irregular
whitespace both saved silently, survived a reload untruncated, and the UI never
stated a limit or showed a counter.

## Root cause

`PATCH /seekers/me` declared its body as an **inline type literal**:

```ts
@Body() dto: { bio?: string; location?: string; interests?: string[]; /* … */ }
```

Nest's global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`, set in
`main.ts`) only validates a body parameter whose metatype is a **class**. An
inline type erases to plain `Object`, so the pipe skipped the endpoint
entirely — no length checks, and no whitelist either. The unvalidated body then
went straight into Prisma:

```ts
return this.prisma.seekerProfile.update({ where: { userId }, data: dto });
```

So alongside the reported issue, a seeker could also write columns the form
never exposes — `onboardingCompleted`, `onboardingStep`, even `userId`.

> A type annotation is documentation, not a runtime guard. Any `@Body()` that
> isn't a DTO class is an unvalidated endpoint, whatever its TypeScript says.

## The fix

**Backend** — `Backend/api/src/modules/seekers/dto/update-seeker-profile.dto.ts`

New `UpdateSeekerProfileDto` class; controller and service now take it. The
service maps each column explicitly instead of spreading the body, so a future
DTO field can't silently become a writable column.

> This pass covered `PATCH /seekers/me` only. A second endpoint writing the same
> columns was missed — see [Second pass](#second-pass--the-register-wizard-wrote-the-same-columns-unbounded).
> The caps below now live in `Backend/api/src/common/seeker-profile-limits.ts`.

| Field             | Limit                          |
| ----------------- | ------------------------------ |
| `bio`             | 1000 characters                |
| `journeyText`     | 1000 characters                |
| `location`        | 100 characters                 |
| `timezone`        | 60 characters                  |
| `interests`       | ≤ 20 entries, ≤ 40 chars each  |
| `practices`       | ≤ 30 entries, ≤ 60 chars each  |
| `experienceLevel` | 40 characters                  |

`experienceLevel` stays free-text rather than an enum, per the deliberate
`SeekerProfile.experienceLevel` schema comment.

**Frontend** — `Frontend/web/src/app/seeker/dashboard/profile/page.tsx`

- `maxLength` on Bio, Interests, Location, Timezone and "What brings you here?"
- Live `123/1000` counters (new shared `CharCount` in
  `components/guide/dashboard-ui.tsx`), turning red at the cap so a truncated
  paste is visible rather than silent.
- Interests shows an entry counter (`3/20`) plus the hint "Up to 20 interests,
  40 characters each" — the per-entry rules have no native HTML equivalent.
- Over-limit Interests are caught before the request with a specific toast; a
  refused submit always says why (see [form-validation-feedback.md](form-validation-feedback.md)).
- The failure toast now surfaces the API's own validation message instead of a
  generic "Failed to update profile".

## Counting units — client and server differ on purpose

`@MaxLength` delegates to validator.js `isLength`, which counts **code points**
(an emoji is 1). The browser's `maxLength` and the on-screen counter count
**UTF-16 code units** (the same emoji is 2).

The numeric caps match, so the **client is always the stricter side**: anything
the form accepts, the API accepts. The gap only shows as the server tolerating
an astral-heavy value the form already refused to let you type.

Do not "align" this by switching the server to a code-unit check — that would
start rejecting saves the counter showed as in-bounds.

## Tests

`Backend/api/src/modules/seekers/dto/update-seeker-profile.dto.spec.ts` — 13
cases: the 2,800-char bio from the report, boundary values, unicode/emoji
interests, per-entry and array-size caps, `null` for the clearable
wizard-deferred fields, and rejection of `onboardingCompleted` / `onboardingStep`
/ `userId`.

## Second pass — the register wizard wrote the same columns unbounded

Re-verifying this defect on 2026-08-31 turned up a route the first fix missed.
**Two** endpoints write the seeker profile's free-text columns:

| Route | DTO | Fields | Caps in the first pass? |
| --- | --- | --- | --- |
| `PATCH /seekers/me` | `UpdateSeekerProfileDto` | all 7 | yes |
| `PATCH /users/seeker/profile` | *(inline in the controller)* | `bio`, `location`, `interests` | **no** |

The second one is what the register wizard's "what calls to your curiosity?"
step calls (`saveInterestsAndContinue` in `register/page.tsx`) — before a seeker
ever reaches a dashboard. Its DTO was declared inside `users.controller.ts`,
confusingly under the *same class name* as the real one, carrying only
`@IsString` / `@IsArray` and no length caps at all. So a 2,800-character bio was
rejected on one route and written on the other.

The [inline-`@Body()` sweep](inline-body-validation-sweep.md) didn't catch it
either: that sweep looked for bodies typed as literals, and this body *was* a
class — just an unbounded one. A class metatype gets you the pipe; it doesn't
get you limits.

The client half was missing too: the "+ Add your own" interest input had no
`maxLength` and the step stated no limit, so a custom interest of any length
went straight to the unbounded route.

**The fix**

- `Backend/api/src/common/seeker-profile-limits.ts` — the caps and their
  messages, in one place outside either module. Both DTOs import it, so the two
  routes can no longer drift. Two hard-coded copies of the numbers is exactly
  how this happened.
- `Backend/api/src/modules/users/dto/update-seeker-basics.dto.ts` — the second
  endpoint's body, now a named, bounded class. Deliberately only the three
  columns its service maps: it is not a back door onto the full profile.
- `UsersService.updateSeekerProfile` now checks the profile exists (a missing
  row made Prisma `P2025` surface as a 500) and maps columns explicitly rather
  than spreading, matching `SeekersService.updateProfile`.
- `register/page.tsx` — `maxLength` on the custom-interest input, a refusal
  toast once 20 interests are picked (a chip that silently won't light up reads
  as a broken button), and a live `n/20 selected · custom interests up to 40
  characters` hint under the tag cloud.

Tests: `Backend/api/src/modules/users/dto/update-seeker-basics.dto.spec.ts` —
the 2,800-char bio on *this* route, boundary values, the unicode/emoji interests
from the report (legal input, not a defect), the code-point vs code-unit
asymmetry, and rejection of fields belonging to `PATCH /seekers/me`.

> When a defect is "fixed", grep for every writer of the column, not just the
> one the reproduction steps went through.

## Follow-ups (both since done)

- The guide dashboard profile page had server caps (`UpdateGuideProfileDto`)
  but no on-screen counter — an over-long bio was a save-time 400 with no
  warning while typing. It now uses the same `CharCount` on Bio and Tagline,
  with `maxLength` on Display Name and Phone.
- The root-cause pattern turned out to be API-wide. See
  [inline-body-validation-sweep.md](inline-body-validation-sweep.md).
