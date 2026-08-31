/**
 * Field caps for the seeker profile's free-text columns.
 *
 * These live here, outside any one module, because *two* endpoints in two
 * different modules write the same columns:
 *
 *   PATCH /seekers/me            → UpdateSeekerProfileDto  (dashboard, all 7 fields)
 *   PATCH /users/seeker/profile  → UpdateSeekerBasicsDto   (register wizard, 3 fields)
 *
 * The second one is why this file exists. When the limits were first added
 * (commit 57c2370) only the dashboard endpoint got them, so `bio`, `location`
 * and `interests` stayed unbounded on the registration path — the same defect,
 * just one route over. Two hard-coded copies of the numbers is how that
 * happens; one shared copy is how it stops.
 *
 * Units: these are compared by class-validator's @MaxLength, which delegates to
 * validator.js `isLength` and counts *code points* (an emoji costs 1). The
 * browser's `maxLength` attribute and the on-screen counters count *UTF-16 code
 * units* (the same emoji costs 2). Both sides use the numbers below, which
 * makes the client the stricter of the two — so anything a form accepts, the
 * API also accepts. Do not "fix" that asymmetry by counting code units on the
 * server: it inverts the relationship and starts 400-ing saves the counter
 * showed as in-bounds.
 *
 * The frontend mirrors these in two places (`LIMITS` in
 * seeker/dashboard/profile/page.tsx and the register wizard's interest input).
 * Change a number here and change it there.
 *
 * See docs/seeker-profile-field-limits.md.
 */
export const SEEKER_PROFILE_LIMITS = {
  bio: 1000,
  journeyText: 1000,
  location: 100,
  timezone: 60,
  experienceLevel: 40,
  interestCount: 20,
  interestLength: 40,
  practiceCount: 30,
  practiceLength: 60,
} as const;

/**
 * Validation messages, shared for the same reason as the numbers: the two
 * endpoints should reject an over-long bio with identical wording, and the
 * dashboard surfaces the API's own text straight into a toast.
 */
export const SEEKER_PROFILE_MESSAGES = {
  bio: `Bio must be ${SEEKER_PROFILE_LIMITS.bio} characters or fewer.`,
  journeyText: `What brings you here must be ${SEEKER_PROFILE_LIMITS.journeyText} characters or fewer.`,
  location: `Location must be ${SEEKER_PROFILE_LIMITS.location} characters or fewer.`,
  timezone: `Timezone must be ${SEEKER_PROFILE_LIMITS.timezone} characters or fewer.`,
  experienceLevel: `Experience level must be ${SEEKER_PROFILE_LIMITS.experienceLevel} characters or fewer.`,
  interestCount: `Add at most ${SEEKER_PROFILE_LIMITS.interestCount} interests.`,
  interestLength: `Each interest must be ${SEEKER_PROFILE_LIMITS.interestLength} characters or fewer.`,
  practiceCount: `Select at most ${SEEKER_PROFILE_LIMITS.practiceCount} practices.`,
  practiceLength: `Each practice must be ${SEEKER_PROFILE_LIMITS.practiceLength} characters or fewer.`,
} as const;
