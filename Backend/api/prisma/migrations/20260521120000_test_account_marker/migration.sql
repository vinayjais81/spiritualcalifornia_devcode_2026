-- ─── Test-account marker for pre-launch onboarding ─────────────────────────
-- Admin manually onboards initial guides using throwaway emails on a known
-- test domain (default scprelaunch.test, configurable via env). When real
-- emails arrive, the admin "Convert test account" workflow swaps the email
-- and fires a claim-invite to the real address. The action is gated on
-- this flag so it can never accidentally redirect a real guide's account.
--
-- Spec: docs/test-account-conversion.md

ALTER TABLE "users" ADD COLUMN "isTestAccount" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "users_isTestAccount_idx" ON "users"("isTestAccount");
