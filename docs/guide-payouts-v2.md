# Guide Payouts — v2 Production-Ready Spec

**Status:** Proposal (locked decisions, ready for implementation)
**Drafted:** 2026-04-29
**Owner:** Payments / Marketplace Ops
**Companion to:** [`GUIDE_EARNINGS_PAYOUT_WORKFLOW.md`](../GUIDE_EARNINGS_PAYOUT_WORKFLOW.md) (v1, shipped 2026-04-13)
**Related:** [`EVENT_CHECKOUT_WORKFLOW.md`](../EVENT_CHECKOUT_WORKFLOW.md), [`SOUL_TOURS_PLAN.md`](../SOUL_TOURS_PLAN.md), `static-to-dynamic-audit.md`

---

## 1. Why v2

A v1 payout system already ships money to guides today. It works for the happy path, but it has structural gaps that block production scale-up:

| v1 behaviour | Production risk |
|---|---|
| 15% flat commission across all categories | Can't price products, events, or partner deals differently |
| Earnings credited to `availableBalance` immediately on `payment_intent.succeeded` | A guide can claim and walk away with money the seeker still has 7 days to refund — direct exposure to chargebacks and no-shows |
| `refund()` issues the Stripe refund but never reverses `availableBalance` / `totalEarned` | Permanent ledger drift; platform absorbs every refund as a loss |
| Stripe processing fee silently absorbed by platform | Margin compression; the 15% commission isn't a real 15% |
| Products skipped (`resolveGuideIdFromPayment` returns undefined for `orderId`) | Product sellers earn nothing through the marketplace |
| Balance fields mutated directly, no journal | No auditable answer to "how did this guide's balance arrive at $X?" — fails financial audit |
| No first-payout fraud hold | New-guide fraud has zero friction |
| No reconciliation against Stripe | Webhook drops, dashboard refunds, fee adjustments all silently desync our DB from Stripe truth |

v2 replaces the balance-mutation model with a **double-entry ledger**, adds **clearance windows**, makes **commission per-category and DB-driven**, and closes the refund / reconciliation loop.

---

## 2. Locked decisions

Confirmed with the user on 2026-04-29:

| # | Decision | Value |
|---|---|---|
| 1 | Commission rates | Services **15%**, Events **12%**, Tours **15%**, Products **10%** (defaults; per-guide overrides allowed) |
| 2 | Stripe processing fee | **Passed through to guide** (deducted from guide's net) |
| 3 | Payout cadence default | **Manual claim** (auto-payout schedule deferred to a future phase) |
| 4 | Minimum payout threshold | **$50** |
| 5 | Clearance windows | Services **T+3d**, Events **T+3d**, Tours **T+5d**, Products **T+7d after delivery** |
| 6 | Negative-balance policy | **Deduct from future earnings** (no immediate clawback / invoice) |
| 7 | First-payout extended hold | **+7 days** added to clearance for the first 3 transactions of every guide |
| 8 | Geography at v1 | **US-only** (1099-NEC via Stripe; international deferred) |

These values become the seed data for the new `CommissionRate` and `ClearanceRule` tables — they are configurable per environment, not hardcoded.

---

## 3. Data model

### 3.1 New tables

#### `LedgerEntry` (the source of truth)

Every cent that moves through the platform writes one or more rows here. Balances are **derived from this table**, never stored as a single mutable field.

```prisma
model LedgerEntry {
  id              String            @id @default(cuid())
  guideId         String            // The guide this entry belongs to
  entryType       LedgerEntryType   // SALE | COMMISSION | STRIPE_FEE | NET_PAYABLE | REFUND_REVERSAL | PAYOUT | ADJUSTMENT | HOLD | RELEASE
  amount          Decimal           @db.Decimal(12, 2)   // Signed: +credit / −debit
  currency        String            @default("USD")
  status          LedgerStatus      // PENDING_CLEARANCE | AVAILABLE | PAID_OUT | REVERSED | HELD
  category        EarningCategory   // SERVICE | EVENT | TOUR | PRODUCT
  clearanceAt     DateTime?         // When PENDING_CLEARANCE flips to AVAILABLE
  paymentId       String?           // Source payment (nullable for adjustments)
  orderItemId     String?           // For PRODUCT entries — which item generated this
  payoutRequestId String?           // Set when the entry is consumed by a payout
  reversalOfId    String?           // For refund entries — the original entry being reversed
  description     String?
  metadata        Json?
  createdAt       DateTime          @default(now())

  guide          GuideProfile   @relation(fields: [guideId], references: [id])
  payment        Payment?       @relation(fields: [paymentId], references: [id])
  orderItem      OrderItem?     @relation(fields: [orderItemId], references: [id])
  payoutRequest  PayoutRequest? @relation(fields: [payoutRequestId], references: [id])
  reversalOf     LedgerEntry?   @relation("Reversal", fields: [reversalOfId], references: [id])
  reversedBy     LedgerEntry[]  @relation("Reversal")

  @@index([guideId, status])
  @@index([guideId, clearanceAt])
  @@index([paymentId])
  @@map("ledger_entries")
}

enum LedgerEntryType {
  SALE             // +gross paid by seeker (informational, on guide's column)
  COMMISSION       // −platform commission
  STRIPE_FEE       // −Stripe processing fee
  NET_PAYABLE      // +net to guide (the only entry that affects payable balance)
  REFUND_REVERSAL  // −clawback of NET_PAYABLE on refund
  PAYOUT           // −money leaves to guide's bank
  PAYOUT_REVERSAL  // +failed-payout refund to balance
  ADJUSTMENT       // ± admin manual entry (with audit trail)
  HOLD             // status-only marker (does not move money)
  RELEASE          // status-only marker
}

enum LedgerStatus {
  PENDING_CLEARANCE   // In the holding window
  AVAILABLE           // Cleared, claimable
  PAID_OUT            // Consumed by a successful payout
  REVERSED            // Cancelled by a refund/chargeback
  HELD                // Frozen by admin (compliance, dispute, suspicion)
}

enum EarningCategory {
  SERVICE
  EVENT
  TOUR
  PRODUCT
}
```

**Balance is a query**, not a stored value:
```sql
-- Available
SELECT SUM(amount) FROM ledger_entries
WHERE guide_id = $1 AND status = 'AVAILABLE' AND entry_type IN ('NET_PAYABLE','REFUND_REVERSAL','ADJUSTMENT','PAYOUT_REVERSAL');

-- Pending
SELECT SUM(amount) FROM ledger_entries
WHERE guide_id = $1 AND status = 'PENDING_CLEARANCE' AND entry_type = 'NET_PAYABLE';
```

We keep the existing `PayoutAccount` row for cached aggregates (cheap reads on the dashboard) but it is rebuilt from the ledger by a nightly cron and a real-time trigger after each ledger write. The ledger is canonical.

#### `CommissionRate`

```prisma
model CommissionRate {
  id              String           @id @default(cuid())
  category        EarningCategory  // SERVICE | EVENT | TOUR | PRODUCT
  guideId         String?          // null = platform default; set = guide-specific override
  percent         Decimal          @db.Decimal(5, 2)   // 15.00 = 15%
  effectiveFrom   DateTime         @default(now())
  effectiveUntil  DateTime?
  createdBy       String?          // Admin user who set it
  createdAt       DateTime         @default(now())

  guide GuideProfile? @relation(fields: [guideId], references: [id])

  @@index([category, guideId, effectiveFrom])
  @@map("commission_rates")
}
```

Lookup at charge time picks the most specific effective row: `(guideId match) → (platform default)`.

Seeded defaults:
| Category | Percent |
|---|---|
| SERVICE | 15.00 |
| EVENT | 12.00 |
| TOUR | 15.00 |
| PRODUCT | 10.00 |

#### `ClearanceRule`

```prisma
model ClearanceRule {
  id        String           @id @default(cuid())
  category  EarningCategory  @unique
  days      Int                                   // 3, 5, 7
  updatedAt DateTime         @updatedAt
  @@map("clearance_rules")
}
```

Seeded: SERVICE=3, EVENT=3, TOUR=5, PRODUCT=7.

For PRODUCT, the clock starts at **delivery confirmation** (a new field on `OrderItem`, see §3.2), not at payment success — physical goods can't clear until they've shipped. For SERVICE the clock starts at **booking end time**; for EVENT at **event end time**; for TOUR at **departure end date**.

#### `PayoutAuditLog`

```prisma
model PayoutAuditLog {
  id              String   @id @default(cuid())
  actorUserId     String                        // Admin who acted
  action          String                        // 'HOLD' | 'RELEASE' | 'PROCESS' | 'ADJUST' | 'CANCEL' | 'OVERRIDE_RATE'
  payoutRequestId String?
  ledgerEntryId   String?
  guideId         String
  reason          String                        // Required for HOLD / ADJUST
  beforeState     Json?
  afterState      Json?
  createdAt       DateTime @default(now())

  @@index([guideId, createdAt])
  @@index([payoutRequestId])
  @@map("payout_audit_logs")
}
```

### 3.2 Modified tables

`PayoutAccount` — add fields, **do not** remove existing balance columns (kept as cached aggregates):

```prisma
model PayoutAccount {
  // ... existing fields ...
  payoutsEnabled         Boolean  @default(false)  // mirrors Stripe `payouts_enabled`
  completedTxnCount      Int      @default(0)      // For first-payout extended hold
  holdActive             Boolean  @default(false)  // Admin-imposed freeze
  holdReason             String?
  holdSetAt              DateTime?
  holdSetBy              String?
}
```

`PayoutRequest` — add fields:

```prisma
model PayoutRequest {
  // ... existing fields ...
  rejectedReason   String?
  cancelledAt      DateTime?
  failureReason    String?       // Stripe error message on FAILED
  ledgerEntries    LedgerEntry[] // Which AVAILABLE entries this payout consumed
}
```

`OrderItem` — add delivery field for product clearance:

```prisma
model OrderItem {
  // ... existing fields ...
  deliveredAt      DateTime?     // Set when shipping carrier confirms delivery
                                 // (digital products: set at order PAID — no shipping)
}
```

`Payment.refundedAmount` is already there; the v2 refund flow uses it as the trigger for `REFUND_REVERSAL` entries.

---

## 4. Money flow (v2)

### 4.1 Charge (PaymentIntent succeeds)

```
payment_intent.succeeded webhook
  → confirmPayment(pi.id)
    → resolve category (service/event/tour/product) + guideId(s)
    → for each guide-attributable line item:
        ├─ lookup CommissionRate(category, guideId) → percent
        ├─ stripeFee = stripeService.estimateFee(amount, currency)
        ├─ commission = amount × percent
        ├─ net = amount − commission − stripeFee
        ├─ clearanceDays = ClearanceRule(category).days + (firstPayoutBonus(guide))
        ├─ clearanceAt = clearanceAnchor(category, entity) + clearanceDays
        └─ createLedgerEntries({
             SALE: +amount (informational),
             COMMISSION: −commission,
             STRIPE_FEE: −stripeFee,
             NET_PAYABLE: +net (status=PENDING_CLEARANCE, clearanceAt)
           })
    → recomputeCachedBalance(guideId)
```

`firstPayoutBonus(guide) = 7 if guide.payoutAccount.completedTxnCount < 3 else 0`.

`clearanceAnchor`:
- SERVICE: `booking.endTime`
- EVENT: `event.endTime`
- TOUR: `tourBooking.departure.endDate`
- PRODUCT: `orderItem.deliveredAt` (clearance entries created in PENDING but `clearanceAt` updated when delivery webhook fires; for digital products, `deliveredAt = order.paidAt`)

**Multi-guide orders**: a single order can have items from multiple guides. v2 splits the order into per-guide ledger sets at confirm time. This unblocks the "Products skipped" gap.

### 4.2 Clearance cron (every 15 minutes)

```sql
UPDATE ledger_entries
SET status = 'AVAILABLE'
WHERE status = 'PENDING_CLEARANCE'
  AND clearance_at IS NOT NULL
  AND clearance_at < now()
  AND guide_id NOT IN (SELECT guide_id FROM payout_accounts WHERE hold_active = true);
```

Followed by `recomputeCachedBalance` for affected guides. Guides whose accounts are on hold do not advance — their entries stay PENDING_CLEARANCE until release.

### 4.3 Payout request

```
POST /payments/payout { amount }
  → validate amount ≥ $50
  → validate available_balance(guide) ≥ amount
  → validate guide.payoutsEnabled = true (Stripe payouts_enabled)
  → validate !payoutAccount.holdActive
  → in a transaction:
      ├─ create PayoutRequest(status=PENDING, amount)
      ├─ pick AVAILABLE ledger entries up to amount (FIFO by clearanceAt)
      ├─ link those entries.payoutRequestId = newPayout.id
      ├─ status of consumed entries → reserved-for-payout (still AVAILABLE flag, but no longer summable; we mark them via payoutRequestId being non-null)
      └─ recomputeCachedBalance(guide)
```

The "available balance" query becomes:
```sql
SELECT SUM(amount) FROM ledger_entries
WHERE guide_id=$1 AND status='AVAILABLE' AND payout_request_id IS NULL;
```

### 4.4 Admin processes payout

```
POST /admin/payout-requests/:id/process
  → existing flow, plus:
    ├─ on COMPLETED: linked ledger entries.status → PAID_OUT, write PayoutAuditLog
    └─ on FAILED: linked entries.payoutRequestId = null (returned to AVAILABLE pool),
                  write PayoutAuditLog(action='PROCESS', failure)
```

### 4.5 Refund (the gap v1 missed)

```
PaymentsService.refund(paymentId, amount)
  → existing Stripe refund call
  → for each refunded share, create REFUND_REVERSAL entries (negative NET_PAYABLE):
      case A: original NET_PAYABLE still PENDING_CLEARANCE
        → just mark original as REVERSED, no clawback needed (money never moved)
      case B: original AVAILABLE, not yet paid out
        → create REFUND_REVERSAL with status=AVAILABLE (signed negative)
        → next balance read shows the deduction
      case C: original PAID_OUT
        → create REFUND_REVERSAL with status=AVAILABLE (signed negative)
        → guide's available balance can go NEGATIVE
        → flag PayoutAccount.negativeBalance = true; next earnings sweep absorbs it
```

The **negative-balance policy** (locked decision #6) is enforced naturally: payouts compute `available = SUM(...)` so a negative entry caps further withdrawals until incoming earnings make the sum positive again.

### 4.6 Disputes / chargebacks

`charge.dispute.created` webhook → same path as refund (case B/C), but ledger entry tagged `metadata.dispute = true` and admin notified.

---

## 5. Stripe fee passthrough

v1: `guideAmount = amount × (1 - 0.15)` — Stripe fee absorbed by platform's share.

v2: `stripeFee = 0.029 × amount + 0.30` (US card default), deducted from guide's portion.

| Example: $100 service booking |
|---|
| Gross: **$100.00** |
| Platform commission (15%): −$15.00 |
| Stripe fee (2.9% + $0.30): −$3.20 |
| **Guide net: $81.80** |

The exact Stripe fee is not known until `balance_transaction` lands (a few hours after the charge). v2 takes the conservative path:
1. **At charge time**: estimate fee, write provisional `STRIPE_FEE` ledger entry.
2. **At reconciliation**: pull the actual `balance_transaction.fee`, write a small `ADJUSTMENT` entry (positive or negative) for the delta. Net is corrected before the entry clears.

This keeps the guide-facing dashboard accurate within rounding cents at clearance time.

---

## 6. KYC gate (already exists, hardened)

v1 already blocks payouts to guides without `stripeOnboardingDone = true`. v2 strengthens this:

- New field `PayoutAccount.payoutsEnabled` mirrors Stripe's authoritative `account.payouts_enabled` (received via `account.updated` webhook).
- The payout-request endpoint requires **both** `stripeOnboardingDone` AND `payoutsEnabled`. Stripe can disable payouts post-onboarding (e.g., requires more info) — v1 doesn't catch this, v2 does.

---

## 7. Reconciliation cron (daily, 2am PT)

A new job pulls `Stripe.balanceTransactions.list` since last run and matches each entry to our ledger:

| Stripe event | Expected ledger match |
|---|---|
| `charge` | `SALE` + `COMMISSION` + `NET_PAYABLE` set |
| `refund` | `REFUND_REVERSAL` set |
| `transfer` | `PAYOUT` entries marked PAID_OUT |
| `application_fee` | `COMMISSION` matches |
| `stripe_fee` | `STRIPE_FEE` (provisional) reconciled to actual |

**Mismatches are surfaced to a `/admin/reconciliation` view** — they are not auto-corrected. Operators triage each one. Common causes: webhook drops (replay), manual Stripe-dashboard refunds (write missing reversal), Connect rounding drift (write small ADJUSTMENT).

---

## 8. Admin surface

### 8.1 Existing `/payouts` page (extends)

Tab 1 — Payout Requests: + a **Hold / Release** action per guide; + a **Reject** action with reason.
Tab 2 — Guide Balances: + **Available** (live), **Pending Clearance** column with hover-detail listing the next 5 entries by clearance date.

### 8.2 New `/admin/commission-rates`

CRUD for `CommissionRate`. Default rates listed; per-guide overrides have effective-date pickers; history of rate changes shown (audit log).

### 8.3 New `/admin/reconciliation`

Daily reconciliation report — matched / unmatched / drift entries. Operator can resolve each unmatched row inline (write the missing ledger entry) with audit trail.

### 8.4 New `/admin/financials/payouts-summary`

Aggregate dashboard: gross volume / commission collected / Stripe fees / paid out / pending / outstanding-payable. Filterable by date and category. CSV export for accounting.

---

## 9. Guide surface

### 9.1 `/guide/dashboard/earnings` (extends existing page)

- **Balance hero**: change "Available" to two figures: **Available $X.XX** / **Pending Clearance $Y.YY**. Pending number has hover-tooltip listing the next 5 entries by clearance date.
- **Min payout banner**: "Minimum payout: $50" (locked).
- **First-payout notice**: until `completedTxnCount ≥ 3`, show a one-line info banner: *"New-guide payouts include a 7-day extended hold for the first 3 transactions. This will lift after your 3rd cleared sale."*
- **Negative balance state**: if `available < 0`, show a clear notice — *"A recent refund was deducted from your balance. New earnings will absorb the difference before the next payout."*
- **Transaction ledger**: per-line breakdown — Gross / Commission / Stripe Fee / Net / Clearance Date / Status.
- **Tax docs link**: deep-link into Stripe Express dashboard (Stripe issues 1099-NEC; we surface the link, not the PDF).

### 9.2 Notifications

| Trigger | Channel |
|---|---|
| Earning credited (on PENDING_CLEARANCE write) | In-app only (rate-limited to once/day per guide) |
| Cleared and available | Email + in-app |
| Payout requested | In-app |
| Payout completed | Email + in-app |
| Payout failed | Email + in-app, with failure reason |
| Hold placed by admin | Email + in-app, with reason |
| Refund clawback | Email + in-app, with order/booking ref |

---

## 10. Implementation phases

| Phase | Scope | Files touched | Effort |
|---|---|---|---|
| **P1 — Schema + ledger** | New tables (LedgerEntry, CommissionRate, ClearanceRule, PayoutAuditLog), migration, seed defaults | `prisma/schema.prisma`, `prisma/seed.ts`, new migration | 0.5 wk |
| **P2 — Ledger write path** | Replace `updateGuideBalance` with `writeLedgerEntries`; per-category commission lookup; Stripe fee deduction; product/order support; recomputeCachedBalance | `payments.service.ts`, new `ledger.service.ts` | 1 wk |
| **P3 — Clearance + first-payout hold** | Cron job, clearance anchor logic, completedTxnCount, KYC gate hardening | New `clearance.processor.ts` (BullMQ), `payments.service.ts`, hooks on Booking/Order/Tour completion | 0.5 wk |
| **P4 — Refund + chargeback reversal** | `refund()` writes REFUND_REVERSAL entries; `charge.dispute.created` webhook | `payments.service.ts` | 0.5 wk |
| **P5 — Payout claim updates** | Min $50, FIFO entry consumption, hold check | `payments.service.ts`, dashboard banner | 0.25 wk |
| **P6 — Admin surfaces** | Hold/release, reject, commission-rate CRUD, audit log, payouts-summary dashboard | `admin.service/controller`, new `/admin/commission-rates` page, extended `/payouts` page | 1 wk |
| **P7 — Reconciliation cron** | Daily Stripe pull, ledger match, mismatch view | New `reconciliation.processor.ts`, new `/admin/reconciliation` page | 0.75 wk |
| **P8 — Notifications + tax doc surfacing** | Email templates + in-app notifications, Stripe Express dashboard deep-link | `notifications.service.ts`, earnings page | 0.5 wk |
| **P9 — Cutover + backfill** | One-shot script: replay all SUCCEEDED Payments through the v2 ledger writer; verify cached balances match v1; archive v1 logic | New `scripts/backfill-ledger.ts`, dry-run + verify modes | 0.5 wk |

**Total: ~5.5 weeks** of focused dev. Phases run mostly serially because P2–P5 share the ledger as the central abstraction; P6–P8 can parallelize once P2 lands.

### Cutover strategy (P9)

1. **Dry-run** the backfill script on a snapshot of prod — assert reconstructed balances equal current `availableBalance + totalPaidOut`. Investigate every drift cent.
2. Deploy v2 code with a feature flag `LEDGER_V2_ENABLED=false` — old path still runs.
3. Run backfill in **idempotent verify-only** mode — confirms parity once more.
4. Run backfill in **write mode** — populates `ledger_entries` for historical Payments. New cached balances should still match.
5. Flip `LEDGER_V2_ENABLED=true`. New payments go through ledger; reads still serve from cached aggregate (kept in sync by recomputeCachedBalance after every write).
6. Watch for 7 days. Then remove the v1 direct-balance-update code path.

No data loss; no guide-visible disruption; rollback = flip the flag.

---

## 11. Edge cases & how they're handled

| Case | v2 handling |
|---|---|
| Refund after payout completed | NET_PAYABLE stays PAID_OUT, REFUND_REVERSAL created with negative amount. Available balance goes negative; next earnings absorb it. Guide notified. |
| Partial refund | Reversal entry uses `(refundAmount / originalAmount) × originalNet`. Commission also pro-rated and credited back to platform. |
| Booking cancelled before clearance | Reversal entries still written for full audit trail; status of reversed PENDING entries → REVERSED (no clawback because nothing cleared). |
| Multi-guide order | Each `OrderItem` resolved to its own guide; one ledger set per guide per order; refund of a single item only reverses that guide's entries. |
| Guide deactivated with positive balance | Account flagged `holdActive=true`, automatic clearance paused; admin processes final payout manually after review. |
| Guide deactivated with negative balance | `holdActive=true`; admin can write off below threshold (e.g. <$10) via ADJUSTMENT entry with audit log; larger amounts go to ops collections. |
| Stripe Connect transfer fails | Existing v1 flow refunds ledger entries (entries' `payoutRequestId` cleared, returned to AVAILABLE pool); guide notified. |
| Webhook duplicate (Stripe retries) | `confirmPayment` already idempotent on payment status; ledger entries keyed by `paymentId` with unique constraint. |
| Manual refund via Stripe Dashboard (no webhook) | Reconciliation cron catches it next day → surfaces unmatched refund → admin resolves with one-click "write missing reversal" |
| Currency mismatch | All v1 currency = USD. v2 enforces USD-only at the Payment level until international launch. |

---

## 12. Out of scope (explicitly deferred)

- Auto-payout schedule (weekly/monthly cron) — manual claim only at v1 ship.
- International guides (non-USD, non-1099 jurisdictions).
- Chargeback reserves (% of pending balance held back for new guides).
- Velocity / fraud rules (anomaly detection, manual review thresholds).
- Subscription billing payouts ($50/mo guide subscription model is its own track per `PROJECT_PLAN.md`).
- Multi-guide event revenue split (single-guide events only).

These remain on the roadmap; none of them are blockers to v2 ship.

---

## 13. Open questions before P1 lands

None. All eight strategic decisions are locked. The only operator inputs needed during build are seed values (already specified above), and the actual Stripe fee formula (US card default = 2.9% + $0.30; can override per-payment if international cards or alternative methods materialise).

---

## 14. Files to be created or modified (summary)

### Backend new files
- `Backend/api/src/modules/payments/ledger.service.ts`
- `Backend/api/src/modules/payments/clearance.processor.ts` (BullMQ)
- `Backend/api/src/modules/payments/reconciliation.processor.ts` (BullMQ)
- `Backend/api/src/modules/admin/commission-rates.service.ts`
- `Backend/api/src/modules/admin/commission-rates.controller.ts`
- `Backend/api/src/modules/admin/reconciliation.controller.ts`
- `Backend/api/scripts/backfill-ledger.ts`
- New Prisma migration

### Backend modified
- `prisma/schema.prisma` — new models + field additions
- `prisma/seed.ts` — CommissionRate, ClearanceRule defaults
- `payments.service.ts` — ledger write path, refund reversal, payout entry consumption
- `payments.controller.ts` — minor (response shape)
- `admin.service.ts` + `admin.controller.ts` — hold/release/reject, audit log, summary endpoint
- `notifications.service.ts` — new payout notification methods
- Stripe webhook switch — add `charge.dispute.created`, `account.updated` (for `payouts_enabled` mirror)

### Frontend new files
- `src/app/(admin)/commission-rates/page.tsx`
- `src/app/(admin)/reconciliation/page.tsx`
- `src/app/(admin)/financials/payouts-summary/page.tsx`

### Frontend modified
- `src/app/guide/dashboard/earnings/page.tsx` — split available/pending, first-payout banner, negative balance state, ledger transaction list
- `src/app/(admin)/payouts/page.tsx` — hold/release/reject actions, pending column, audit log drawer
- `src/components/admin/sidebar.tsx` — Commission Rates, Reconciliation entries

---

## 15. Acceptance criteria

v2 is "production ready" when:

- [ ] Every cent that moves through the platform has matching `LedgerEntry` rows
- [ ] `recomputeCachedBalance` always equals the SUM-from-ledger query (verified by a daily integrity cron)
- [ ] Refunds ALWAYS create reversal entries; `Payment.refundedAmount > 0` with no matching reversal is impossible
- [ ] No guide can be paid out funds whose underlying payment was refunded — verified by an automated test
- [ ] Per-category commission resolves correctly with at least one per-guide override active in QA
- [ ] First 3 transactions for a fresh test guide land with `clearanceAt = anchor + categoryDays + 7` ; the 4th lands without the +7
- [ ] Min payout enforces $50 (test: $49.99 rejected, $50.00 accepted)
- [ ] Reconciliation cron runs daily, surfaces a manual Stripe-dashboard refund as unmatched, and resolves to zero drift after operator action
- [ ] Stripe fee from `balance_transaction` reconciles within 1¢ of the provisional fee written at charge time
- [ ] All admin payout actions (hold, release, reject, process, adjust, override-rate) write to `PayoutAuditLog`
- [ ] Backfill script reproduces v1 cached balances exactly when run on a prod snapshot
- [ ] All eight locked decisions are configurable via DB or env, not hardcoded

---

**Next step:** with this doc approved, P1 (schema + migration + seed) is the first PR.
