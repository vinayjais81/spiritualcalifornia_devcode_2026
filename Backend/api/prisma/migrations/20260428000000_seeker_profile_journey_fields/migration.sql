-- Add the wizard's step 4 + 5 fields to SeekerProfile so that registration
-- can be deferred to "Edit Profile" after email verification, instead of
-- forcing the user back through the wizard on every login.
--
-- experienceLevel: 'beginner' | 'explorer' | 'practitioner' | 'teacher'
-- practices:       string[] — e.g. ['meditation', 'breathwork']
-- journeyText:     free-text "what brings you here" used by the AI matcher

ALTER TABLE "seeker_profiles" ADD COLUMN IF NOT EXISTS "experienceLevel" TEXT;
ALTER TABLE "seeker_profiles" ADD COLUMN IF NOT EXISTS "practices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "seeker_profiles" ADD COLUMN IF NOT EXISTS "journeyText" TEXT;

-- Backfill: any seeker whose linked User has already verified their email
-- is treated as fully onboarded under the new rules, even if they bailed
-- out of the wizard at step 3+. They'll get the dashboard's profile-
-- completeness widget instead of being trapped in the wizard.
UPDATE "seeker_profiles" sp
SET "onboardingCompleted" = TRUE
FROM "users" u
WHERE sp."userId" = u."id"
  AND sp."onboardingCompleted" = FALSE
  AND u."isEmailVerified" = TRUE;
