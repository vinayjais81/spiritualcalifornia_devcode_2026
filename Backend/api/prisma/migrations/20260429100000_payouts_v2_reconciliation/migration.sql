-- Reconciliation mismatch surface — see docs/guide-payouts-v2.md §7.

CREATE TABLE "reconciliation_mismatches" (
  "id"                       TEXT          NOT NULL,
  "stripeBalanceTxnId"       TEXT          NOT NULL,
  "stripeType"               TEXT          NOT NULL,
  "stripeAmount"             DECIMAL(12,2) NOT NULL,
  "stripeCurrency"           TEXT          NOT NULL DEFAULT 'USD',
  "stripeCreatedAt"          TIMESTAMP(3)  NOT NULL,
  "expectedLedgerEntryType"  TEXT,
  "paymentId"                TEXT,
  "details"                  JSONB,
  "resolved"                 BOOLEAN       NOT NULL DEFAULT false,
  "resolvedAt"               TIMESTAMP(3),
  "resolvedBy"               TEXT,
  "resolutionNote"           TEXT,
  "createdAt"                TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reconciliation_mismatches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reconciliation_mismatches_stripeBalanceTxnId_key" UNIQUE ("stripeBalanceTxnId")
);

CREATE INDEX "reconciliation_mismatches_resolved_createdAt_idx"
  ON "reconciliation_mismatches" ("resolved", "createdAt");
