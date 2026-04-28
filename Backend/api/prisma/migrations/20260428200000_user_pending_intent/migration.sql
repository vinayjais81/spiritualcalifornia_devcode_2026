-- Add pendingIntent column to users so /auth/verify-email knows what role
-- and profile side-effects to run after email verification succeeds.
-- Values: 'seeker' | 'guide'. Null for legacy / Google-OAuth users.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pendingIntent" TEXT;
