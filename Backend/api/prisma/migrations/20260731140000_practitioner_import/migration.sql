-- Practitioner spreadsheet import — Phase 1 (2026-07-31)
--
-- Admin uploads a practitioner list; parsed rows land as prospects and the
-- importable ones become invited guide accounts on commit. Rows that can't
-- become accounts (no email, duplicate, suppressed) are kept deliberately:
-- they are the manual-outreach work queue, not discarded.
--
-- See docs/practitioner-import-invite-strategy.md.

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "ImportBatchStatus" AS ENUM ('DRAFT', 'COMMITTED', 'ARCHIVED');

CREATE TYPE "ProspectStatus" AS ENUM (
  'PENDING',
  'NEEDS_REVIEW',
  'SKIPPED_NO_EMAIL',
  'SKIPPED_DUPLICATE',
  'SKIPPED_SUPPRESSED',
  'SKIPPED_NOT_A_PERSON',
  'EXCLUDED',
  'ACCOUNT_CREATED'
);

CREATE TYPE "SuppressionReason" AS ENUM (
  'UNSUBSCRIBED',
  'DELETED',
  'BOUNCED',
  'COMPLAINED',
  'MANUAL'
);

-- ── Batches ──────────────────────────────────────────────────────────────────

CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "uploadedById" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsImportable" INTEGER NOT NULL DEFAULT 0,
    "accountsCreated" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_batches_status_createdAt_idx" ON "import_batches"("status", "createdAt");

ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Prospects ────────────────────────────────────────────────────────────────

CREATE TABLE "imported_prospects" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    -- sheet + normalised name + city; lets a re-import reconcile onto the same
    -- row instead of duplicating it and losing the outreach notes.
    "fingerprint" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "modality" TEXT,
    "websiteUrl" TEXT,
    "categorySlug" TEXT,
    "subcategorySlug" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "workedNote" TEXT,
    "workedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_prospects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "imported_prospects_userId_key" ON "imported_prospects"("userId");
CREATE UNIQUE INDEX "imported_prospects_batchId_fingerprint_key" ON "imported_prospects"("batchId", "fingerprint");
CREATE INDEX "imported_prospects_batchId_status_idx" ON "imported_prospects"("batchId", "status");
CREATE INDEX "imported_prospects_fingerprint_idx" ON "imported_prospects"("fingerprint");
CREATE INDEX "imported_prospects_email_idx" ON "imported_prospects"("email");

ALTER TABLE "imported_prospects" ADD CONSTRAINT "imported_prospects_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imported_prospects" ADD CONSTRAINT "imported_prospects_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Suppression tombstones ───────────────────────────────────────────────────
-- Holds an HMAC of the address, never the address. Deleting a practitioner's
-- row and nothing else would let the next import of the same spreadsheet
-- recreate them and email them again.

CREATE TABLE "email_suppressions" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_suppressions_emailHash_key" ON "email_suppressions"("emailHash");

-- ── Provenance on the guide profile ──────────────────────────────────────────

ALTER TABLE "guide_profiles" ADD COLUMN "importBatchId" TEXT;

ALTER TABLE "guide_profiles" ADD CONSTRAINT "guide_profiles_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
