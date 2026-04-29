-- Payouts v2 — production-ready ledger, per-category commission, clearance,
-- audit log, and webhook idempotency. v1 PayoutAccount/PayoutRequest tables
-- continue to work; their balance columns become cached aggregates rebuilt
-- from ledger_entries by the LedgerService.
--
-- See: docs/guide-payouts-v2.md  (P1 schema phase)

-- ─────────────────────────────────────────────
-- Required extension for gen_random_uuid() on Postgres < 13.
-- (No-op on PG 13+ where it's in core.) Idempotent.
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────

CREATE TYPE "LedgerEntryType" AS ENUM (
  'SALE',
  'COMMISSION',
  'STRIPE_FEE',
  'NET_PAYABLE',
  'REFUND_REVERSAL',
  'PAYOUT',
  'PAYOUT_REVERSAL',
  'ADJUSTMENT'
);

CREATE TYPE "LedgerStatus" AS ENUM (
  'PENDING_CLEARANCE',
  'AVAILABLE',
  'PAID_OUT',
  'REVERSED',
  'HELD'
);

CREATE TYPE "EarningCategory" AS ENUM (
  'SERVICE',
  'EVENT',
  'TOUR',
  'PRODUCT'
);

ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- ─────────────────────────────────────────────
-- payout_accounts: extended fields
-- ─────────────────────────────────────────────

ALTER TABLE "payout_accounts"
  ADD COLUMN IF NOT EXISTS "payoutsEnabled"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "completedTxnCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "holdActive"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "holdReason"        TEXT,
  ADD COLUMN IF NOT EXISTS "holdSetAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "holdSetBy"         TEXT;

-- Widen balance precision from (10,2) to (12,2) to safely cover lifetime totals.
ALTER TABLE "payout_accounts"
  ALTER COLUMN "availableBalance" TYPE DECIMAL(12,2),
  ALTER COLUMN "pendingBalance"   TYPE DECIMAL(12,2),
  ALTER COLUMN "totalEarned"      TYPE DECIMAL(12,2),
  ALTER COLUMN "totalPaidOut"     TYPE DECIMAL(12,2);

-- ─────────────────────────────────────────────
-- payout_requests: extended fields + index
-- ─────────────────────────────────────────────

ALTER TABLE "payout_requests"
  ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failureReason"  TEXT;

ALTER TABLE "payout_requests"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2);

CREATE INDEX IF NOT EXISTS "payout_requests_status_createdAt_idx"
  ON "payout_requests" ("status", "createdAt");

-- ─────────────────────────────────────────────
-- orders: paidAt
-- ─────────────────────────────────────────────

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- Backfill existing PAID orders (best-effort: use updatedAt as a proxy).
UPDATE "orders" SET "paidAt" = "updatedAt"
  WHERE "status" IN ('PAID','SHIPPED','DELIVERED','REFUNDED')
    AND "paidAt" IS NULL;

-- ─────────────────────────────────────────────
-- order_items: deliveredAt (drives PRODUCT clearance anchor)
-- ─────────────────────────────────────────────

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- Backfill: digital products are "delivered" at order PAID time.
-- Physical: only DELIVERED orders count.
UPDATE "order_items" oi
  SET "deliveredAt" = o."paidAt"
  FROM "orders" o, "products" p
  WHERE oi."orderId" = o."id"
    AND oi."productId" = p."id"
    AND p."type" = 'DIGITAL'
    AND o."paidAt" IS NOT NULL
    AND oi."deliveredAt" IS NULL;

UPDATE "order_items" oi
  SET "deliveredAt" = o."updatedAt"
  FROM "orders" o
  WHERE oi."orderId" = o."id"
    AND o."status" = 'DELIVERED'
    AND oi."deliveredAt" IS NULL;

-- ─────────────────────────────────────────────
-- ledger_entries — source of truth for guide money flow
-- ─────────────────────────────────────────────

CREATE TABLE "ledger_entries" (
  "id"              TEXT              NOT NULL,
  "guideId"         TEXT              NOT NULL,
  "entryType"       "LedgerEntryType" NOT NULL,
  "amount"          DECIMAL(12,2)     NOT NULL,
  "currency"        TEXT              NOT NULL DEFAULT 'USD',
  "status"          "LedgerStatus"    NOT NULL,
  -- Nullable on purpose: PAYOUT and ADJUSTMENT entries aren't tied to a
  -- single category (a payout aggregates earnings across all categories).
  -- Category-filtered queries naturally exclude these rows.
  "category"        "EarningCategory",
  "clearanceAt"     TIMESTAMP(3),
  "paymentId"       TEXT,
  "orderItemId"     TEXT,
  "payoutRequestId" TEXT,
  "reversalOfId"    TEXT,
  "description"     TEXT,
  "metadata"        JSONB,
  "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_guideId_fkey" FOREIGN KEY ("guideId")
    REFERENCES "guide_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "ledger_entries_paymentId_fkey" FOREIGN KEY ("paymentId")
    REFERENCES "payments"("id") ON DELETE SET NULL,
  CONSTRAINT "ledger_entries_orderItemId_fkey" FOREIGN KEY ("orderItemId")
    REFERENCES "order_items"("id") ON DELETE SET NULL,
  CONSTRAINT "ledger_entries_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId")
    REFERENCES "payout_requests"("id") ON DELETE SET NULL,
  CONSTRAINT "ledger_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId")
    REFERENCES "ledger_entries"("id") ON DELETE SET NULL
);

CREATE INDEX "ledger_entries_guideId_status_idx"      ON "ledger_entries" ("guideId", "status");
CREATE INDEX "ledger_entries_guideId_clearanceAt_idx" ON "ledger_entries" ("guideId", "clearanceAt");
CREATE INDEX "ledger_entries_paymentId_idx"           ON "ledger_entries" ("paymentId");
CREATE INDEX "ledger_entries_payoutRequestId_idx"     ON "ledger_entries" ("payoutRequestId");

-- ─────────────────────────────────────────────
-- commission_rates
-- ─────────────────────────────────────────────

CREATE TABLE "commission_rates" (
  "id"             TEXT              NOT NULL,
  "category"       "EarningCategory" NOT NULL,
  "guideId"        TEXT,
  "percent"        DECIMAL(5,2)      NOT NULL,
  "effectiveFrom"  TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveUntil" TIMESTAMP(3),
  "createdBy"      TEXT,
  "createdAt"      TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commission_rates_guideId_fkey" FOREIGN KEY ("guideId")
    REFERENCES "guide_profiles"("id") ON DELETE SET NULL
);

CREATE INDEX "commission_rates_category_guideId_effectiveFrom_idx"
  ON "commission_rates" ("category", "guideId", "effectiveFrom");

-- Seed platform defaults (locked decisions, 2026-04-29).
INSERT INTO "commission_rates" ("id", "category", "guideId", "percent", "effectiveFrom") VALUES
  (gen_random_uuid()::text, 'SERVICE', NULL, 15.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EVENT',   NULL, 12.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TOUR',    NULL, 15.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRODUCT', NULL, 10.00, CURRENT_TIMESTAMP);

-- ─────────────────────────────────────────────
-- clearance_rules
-- ─────────────────────────────────────────────

CREATE TABLE "clearance_rules" (
  "id"        TEXT              NOT NULL,
  "category"  "EarningCategory" NOT NULL,
  "days"      INTEGER           NOT NULL,
  "createdAt" TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)      NOT NULL,
  CONSTRAINT "clearance_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clearance_rules_category_key" UNIQUE ("category")
);

INSERT INTO "clearance_rules" ("id", "category", "days", "updatedAt") VALUES
  (gen_random_uuid()::text, 'SERVICE', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EVENT',   3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TOUR',    5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRODUCT', 7, CURRENT_TIMESTAMP);

-- ─────────────────────────────────────────────
-- payout_audit_logs
-- ─────────────────────────────────────────────

CREATE TABLE "payout_audit_logs" (
  "id"              TEXT         NOT NULL,
  "actorUserId"     TEXT         NOT NULL,
  "action"          TEXT         NOT NULL,
  "payoutRequestId" TEXT,
  "ledgerEntryId"   TEXT,
  -- Nullable: platform-level events (e.g. OVERRIDE_RATE on a default rate
  -- with no per-guide override) don't target a specific guide.
  "guideId"         TEXT,
  "reason"          TEXT         NOT NULL,
  "beforeState"     JSONB,
  "afterState"      JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payout_audit_logs_guideId_createdAt_idx" ON "payout_audit_logs" ("guideId", "createdAt");
CREATE INDEX "payout_audit_logs_payoutRequestId_idx"   ON "payout_audit_logs" ("payoutRequestId");

-- ─────────────────────────────────────────────
-- stripe_webhook_events — generic webhook idempotency cache
-- ─────────────────────────────────────────────

CREATE TABLE "stripe_webhook_events" (
  "id"          TEXT         NOT NULL,
  "type"        TEXT         NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload"     JSONB,
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stripe_webhook_events_type_processedAt_idx"
  ON "stripe_webhook_events" ("type", "processedAt");
