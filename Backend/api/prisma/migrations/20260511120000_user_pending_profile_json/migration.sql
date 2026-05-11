-- Adds a sparse JSON column on users where the register endpoint can stash
-- wizard step 1 profile fields (bio, tagline, location, languages, websiteUrl,
-- timezone) until /auth/verify-email creates the GuideProfile and applies
-- them. Cleared after application; null for users registered before this
-- flow shipped.
ALTER TABLE "users" ADD COLUMN "pendingProfileJson" JSONB;
