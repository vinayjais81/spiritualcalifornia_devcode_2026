-- Practitioner invite sending — Phase 3 (2026-07-31)
--
-- Adds a record of every attempted email (there was none — EmailService sent
-- inline and kept nothing), plus per-batch wave state so a send can be paused
-- mid-flight by an admin or by the circuit breaker.
--
-- email_sends deliberately stores a HASH of the recipient, never the address:
-- a practitioner who later asks to be removed must not be left behind in the
-- send log. The address is resolved from the user row at send time.
--
-- See docs/practitioner-import-invite-strategy.md §4.6.

CREATE TYPE "InviteSendState" AS ENUM ('IDLE', 'SENDING', 'PAUSED', 'COMPLETED');

CREATE TYPE "EmailSendStatus" AS ENUM (
  'QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'SKIPPED'
);

-- ── Wave state on the batch ──────────────────────────────────────────────────

ALTER TABLE "import_batches" ADD COLUMN "inviteState" "InviteSendState" NOT NULL DEFAULT 'IDLE';
ALTER TABLE "import_batches" ADD COLUMN "invitePausedAt" TIMESTAMP(3);
ALTER TABLE "import_batches" ADD COLUMN "invitePauseReason" TEXT;

-- ── Send log ─────────────────────────────────────────────────────────────────

CREATE TABLE "email_sends" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" TEXT,
    "importBatchId" TEXT,
    "emailHash" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    -- Redirected sends are test traffic. They are excluded from deliverability
    -- stats so they cannot poison the circuit breaker's judgement.
    "redirected" BOOLEAN NOT NULL DEFAULT false,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_sends_importBatchId_status_idx" ON "email_sends"("importBatchId", "status");
CREATE INDEX "email_sends_providerMessageId_idx" ON "email_sends"("providerMessageId");
CREATE INDEX "email_sends_purpose_sentAt_idx" ON "email_sends"("purpose", "sentAt");

ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
