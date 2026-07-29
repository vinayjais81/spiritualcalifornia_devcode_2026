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

## Not covered

The guide profile's Bio has server-side limits already
(`UpdateGuideProfileDto`, 2000) but no on-screen counter on the guide dashboard
profile page. Same treatment would apply there; out of scope for this fix.
