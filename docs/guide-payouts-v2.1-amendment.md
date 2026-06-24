# Guide Payouts — v2.1 Policy Amendment

**Status:** Approved — ready for implementation
**Drafted:** 2026-06-24
**Owner:** Payments / Marketplace Ops
**Amends:** [`guide-payouts-v2.md`](./guide-payouts-v2.md) (the v2 production-ready spec)
**Source:** Client requirement *"Implement Practitioner Payout Policy"* (shared 2026-06-24) + clarification answers (same day)

---

## 1. Why this amendment

The v2 spec locked eight decisions on 2026-04-29. The client's new **Practitioner Payout Policy** revises five of them. This document records the delta, the clarification answers, and the implementation surface. Where v2 and this amendment disagree, **this amendment wins**. Everything in v2 not contradicted here (double-entry ledger, refund reversal, reconciliation cron, KYC gate, first-payout hold, admin/guide surfaces) stays exactly as built.

---

## 2. The client policy (verbatim intent)

| Category | Platform (SC) | Practitioner |
|---|---|---|
| Events (workshops, retreats, gatherings) | 20% | 80% |
| 1:1 Sessions | 20% | 80% |
| Products (Conscious Shop) | *(unchanged)* | *(unchanged)* |

- Commission is calculated on the **gross sale**.
- The **Stripe processing fee comes out of the platform's share**, so the practitioner always nets **exactly** their stated percentage.
- **Release timing** — release date = the *later of* (delivery confirmed) or (refund window closed) **+ a 3-day dispute buffer**. Never a flat number of days from purchase.
  - Events: event end date + 3 days
  - Sessions: session end + 3 days (auto-complete the session if not disputed)
  - Products: delivery confirmed + 14-day return window (+ 3-day buffer)
  - Fallback if no tracking = order date + 21 days
  - Funds release **only if there is no open refund, dispute, or chargeback** on the transaction.
- **Minimum payout threshold** — minimum transfer is **$100**. A payout fires only when a practitioner's total **releasable** balance reaches $100+. Balances under $100 **roll over** to the next cycle until the threshold is met.

---

## 3. Clarification answers (locked 2026-06-24)

| # | Question | Answer |
|---|---|---|
| Q1 | Products commission % (cell was blank) | **Leave unchanged — PRODUCT stays 10%** |
| Q2 | Tours not mentioned in the policy | **Fold Tours into Events: 20% commission, clearance = departure end + 3 days** |
| Q3 | "Payout fires / rolls over" — auto-payout? | **Yes — client is OK with automatic, cycle-based payouts** |
| Q4 | Product buffer additive or inclusive? | **Additive — 17 days after delivery** (14-day return window + 3-day buffer) |

---

## 4. Decision delta (v2 → v2.1)

| v2 locked decision | v2 value | **v2.1 value** | Change |
|---|---|---|---|
| #1 Commission — SERVICE (1:1 Sessions) | 15% | **20%** | ⬆ |
| #1 Commission — EVENT | 12% | **20%** | ⬆ |
| #1 Commission — TOUR | 15% | **20%** (Tours folded into Events) | ⬆ |
| #1 Commission — PRODUCT | 10% | **10%** | unchanged |
| #2 Stripe processing fee | passed through to **guide** | absorbed by **platform** — guide nets exactly the stated % | **reversed** |
| #3 Payout cadence | manual claim only | **automatic cycle-based sweep** (manual claim retained as an option) | **new** |
| #4 Minimum payout | $50 | **$100** | ⬆ |
| #5 Clearance — SERVICE / EVENT | T+3d | T+3d | unchanged |
| #5 Clearance — TOUR | T+5d | **T+3d** (folded into Events) | ⬇ |
| #5 Clearance — PRODUCT | delivered + 7d | **delivered + 17d** (14 return + 3 buffer) | ⬆ |
| #5 Clearance — PRODUCT no-delivery fallback | *(none — funds never cleared)* | **order paid date + 21 days** | **new** |
| #7 First-payout +7d hold | kept | **kept** (anchor-relative, not "flat from purchase" — compatible) | unchanged |

Decisions #6 (negative-balance policy) and #8 (US-only) are untouched.

---

## 5. Money math change (the important one)

v2: `net = gross − commission − stripeFee` — the Stripe fee shrank the guide's payout.

**v2.1:** `net = gross − commission`. The guide receives exactly `gross × (1 − commission%)`. The platform absorbs the Stripe fee out of its commission.

The `STRIPE_FEE` ledger entry is **still written** (negative, informational) so platform P&L reporting and reconciliation can see the fee — but it **no longer reduces `NET_PAYABLE`** (the only entry that drives guide balance). The platform's effective take is `commission − stripeFee`, computed in reporting, not on the guide's column.

| Example: $100 1:1 session | v2 (guide pays fee) | **v2.1 (platform pays fee)** |
|---|---|---|
| Gross | $100.00 | $100.00 |
| Commission (20%) | −$20.00 | −$20.00 |
| Stripe fee (2.9% + $0.30) | −$3.20 (off guide) | −$3.20 (off platform) |
| **Guide net (`NET_PAYABLE`)** | $81.80 (at 20%) | **$80.00 exactly** |
| Platform net take | $20.00 | $16.80 |

**Margin safety:** 20% commission comfortably exceeds the Stripe fee for any sale above ~$0.40, and 10% covers products above ~$0.43, so the platform's net take is always positive. The `ADJUSTMENT` written by the reconciliation cron for the *actual* fee delta (v2 §5) now adjusts the **platform** side only — it must never touch a guide's `NET_PAYABLE`.

---

## 6. Implementation surface

### 6.1 New migration — `20260624000000_payouts_v2_1_policy`
- **Commission** (effective-dated to preserve audit history): close the existing platform-default `SERVICE / EVENT / TOUR` rows (`effectiveUntil = now`), insert new platform-default rows at **20.00**. PRODUCT left as-is (10.00).
- **Clearance** (single row per category): `UPDATE clearance_rules SET days = 3 WHERE category = 'TOUR'` and `days = 17 WHERE category = 'PRODUCT'`. SERVICE/EVENT unchanged at 3.

### 6.2 `ledger.service.ts`
- `writeChargeEntries`: `net = round2(grossAmount - commission)` — **drop** `- stripeFee`. Keep writing the informational `STRIPE_FEE` entry.
- `writeChargeEntries`: accept an optional `clearanceDaysOverride` (used by the product no-delivery fallback to force a 21-day-from-order clearance).
- `defaultClearanceDays` fallback: `TOUR → 3`, `PRODUCT → 17` (matches the migration so an empty table degrades to policy values).
- Update the worked-example comment in §5 region to reflect platform-absorbed fee.

### 6.3 `payments.service.ts`
- Minimum payout: replace the hardcoded `if (amount < 50)` with a config-driven `MIN_PAYOUT_USD` (default **100**).
- **Product no-delivery fallback**: a sweep that finds physical `OrderItem`s on PAID orders older than 21 days with `deliveredAt = null` and no existing `NET_PAYABLE` ledger entry, and writes the fan-out with `clearanceAnchor = order.paidAt` and `clearanceDaysOverride = 21` so funds eventually release even when delivery is never confirmed.
- **Auto-payout sweep** (`runAutoPayoutSweep`): for each eligible payout account (`payoutsEnabled`, `!holdActive`, `stripeOnboardingDone`) whose releasable available balance ≥ `MIN_PAYOUT_USD`, create a payout for the **full releasable balance** (reusing the v2 FIFO reservation path) and process the Stripe transfer end-to-end. Balances under the threshold are left untouched (they "roll over"). Gated behind `AUTO_PAYOUT_ENABLED` **and** `LEDGER_V2_ENABLED`.

### 6.4 `payouts-tasks.queue.ts`
- **Clearance guard**: the `runClearance` candidate query must exclude `NET_PAYABLE` entries whose source `Payment` has an open refund/dispute (`status IN (REFUNDED, PARTIALLY_REFUNDED)` or `refundedAmount > 0`). This enforces "release only if no open refund, dispute, or chargeback" at flip time, in addition to the existing `holdActive` guard.
- **Product fallback job**: run the no-delivery fallback sweep on the clearance cadence (or fold into the clearance job).
- **Auto-payout job**: new repeatable job calling `paymentsService.runAutoPayoutSweep()`. Default cron `AUTO_PAYOUT_CRON = 0 11 * * *` (≈ 04:00 PT, after reconciliation + integrity). Inject `PaymentsService` (one-directional — no cycle).

### 6.5 Config / env
- `MIN_PAYOUT_USD` default `50` → **`100`** (config endpoint already surfaces this to the guide dashboard, so the UI threshold copy updates automatically).
- New: `AUTO_PAYOUT_ENABLED` (default `false` — opt-in per environment, matching the `LEDGER_V2_ENABLED` rollout discipline), `AUTO_PAYOUT_CRON` (default `0 11 * * *`).

### 6.6 Not changing
- Double-entry ledger, refund/dispute reversal, reconciliation + integrity crons, KYC/`payoutsEnabled` gate, first-payout +7d hold, admin hold/release, guide earnings page mechanics. The manual claim endpoint stays — auto-payout is additive.

---

## 7. Rollout

1. Ship code + migration with `AUTO_PAYOUT_ENABLED=false`. Commission, fee, clearance, and threshold changes take effect immediately for **new** charges (existing pending entries keep the clearance they were written with).
2. Verify on QA: a fresh $100 session nets the guide exactly $80; a product clears 17 days after delivery; an undelivered product clears 21 days after order; min payout rejects $99.99 and accepts $100.
3. Flip `AUTO_PAYOUT_ENABLED=true` once manual-claim parity is confirmed. Watch the first sweep, then leave it running.

Rollback for auto-payout = flip the flag. The commission/fee/clearance changes roll back via a reverse migration if ever needed.

---

## 8. Acceptance criteria

- [ ] New $100 session / event / tour nets the guide exactly $80.00 (`NET_PAYABLE`), with a separate informational `STRIPE_FEE` entry that does not reduce guide balance.
- [ ] New $100 product nets the guide $90.00 (10% unchanged).
- [ ] TOUR earnings clear at departure end + 3 days; PRODUCT at delivery + 17 days.
- [ ] A physical product never marked delivered clears at order-paid + 21 days.
- [ ] A `NET_PAYABLE` whose payment has an open refund/dispute does **not** flip to AVAILABLE.
- [ ] Min payout rejects $99.99, accepts $100.00.
- [ ] With `AUTO_PAYOUT_ENABLED=true`, a guide with ≥ $100 releasable balance is paid automatically on the next sweep; a guide with < $100 is skipped (rolls over).
- [ ] Reconciliation fee `ADJUSTMENT` entries affect platform P&L only, never a guide's `NET_PAYABLE`.
