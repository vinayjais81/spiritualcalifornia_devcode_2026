-- Proactive-invite funnel timestamps (2026-07-31)
--
-- Phase 2 of docs/practitioner-import-invite-strategy.md. Lets the import
-- batch report show invited → claimed directly, rather than reconstructing the
-- funnel from audit logs.
--
-- Both stay null for self-registered users.

ALTER TABLE "users" ADD COLUMN "invitedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "inviteClaimedAt" TIMESTAMP(3);
