import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EarningCategory,
  LedgerEntryType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * Source of truth for all guide money flow.
 *
 * v1 mutated PayoutAccount.availableBalance directly. v2 writes one row per
 * money event into ledger_entries; the cached PayoutAccount columns are
 * rebuilt by recomputeCachedBalance after every write so v1 reads keep working
 * during the LEDGER_V2_ENABLED rollout.
 *
 * Charge fan-out: a single seeker payment becomes 4 entries per attributable
 * guide line item — SALE (informational), COMMISSION (−), STRIPE_FEE (−),
 * NET_PAYABLE (+ in PENDING_CLEARANCE). Multi-guide orders generate one set
 * per OrderItem, each with the right guideId.
 *
 * See: docs/guide-payouts-v2.md §4 (Money flow).
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  private readonly stripeFeePercent: number;
  private readonly stripeFeeFlat: number;
  private readonly fallbackCommissionPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // US card default. Override per env if launching with non-card or
    // international cards. Reconciliation cron writes ADJUSTMENT entries
    // for the actual fee from balance_transaction.
    this.stripeFeePercent = Number(this.config.get('STRIPE_PROCESSING_FEE_PERCENT', '2.9')) / 100;
    this.stripeFeeFlat = Number(this.config.get('STRIPE_PROCESSING_FEE_FLAT', '0.30'));
    // Safety net only — used if no CommissionRate row exists for a category.
    this.fallbackCommissionPercent = Number(
      this.config.get('STRIPE_PLATFORM_COMMISSION_PERCENT', '15'),
    );
  }

  // ─── Core writer ───────────────────────────────────────────────────────────

  /**
   * Writes one charge fan-out (SALE / COMMISSION / STRIPE_FEE / NET_PAYABLE)
   * for one guide-attributable line. Idempotent on (paymentId, guideId,
   * orderItemId): if entries already exist for this combination, returns
   * the existing set without re-writing.
   *
   * Caller must already have resolved guideId from the entity. The clearance
   * anchor + first-payout bonus are computed here based on the category and
   * the guide's PayoutAccount.completedTxnCount.
   */
  async writeChargeEntries(input: {
    guideId: string;
    paymentId: string;
    orderItemId?: string;
    grossAmount: number;
    category: EarningCategory;
    clearanceAnchor: Date;
    description?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<{ entries: any[]; net: number; commission: number; stripeFee: number }> {
    // Idempotency: if NET_PAYABLE already exists for this (paymentId, guideId, orderItemId), bail.
    const existing = await this.prisma.ledgerEntry.findFirst({
      where: {
        paymentId: input.paymentId,
        guideId: input.guideId,
        orderItemId: input.orderItemId ?? null,
        entryType: 'NET_PAYABLE',
      },
    });
    if (existing) {
      this.logger.log(
        `Charge entries already exist for payment ${input.paymentId} guide ${input.guideId}${input.orderItemId ? ` item ${input.orderItemId}` : ''} — skipping`,
      );
      // Return the existing fan-out so callers can still inspect the result.
      const all = await this.prisma.ledgerEntry.findMany({
        where: {
          paymentId: input.paymentId,
          guideId: input.guideId,
          orderItemId: input.orderItemId ?? null,
        },
      });
      const find = (t: LedgerEntryType) => all.find((e) => e.entryType === t);
      return {
        entries: all,
        net: Number(find('NET_PAYABLE')?.amount ?? 0),
        commission: Math.abs(Number(find('COMMISSION')?.amount ?? 0)),
        stripeFee: Math.abs(Number(find('STRIPE_FEE')?.amount ?? 0)),
      };
    }

    const commissionPercent = await this.resolveCommissionPercent(
      input.category,
      input.guideId,
    );
    const commission = round2(input.grossAmount * (commissionPercent / 100));
    const stripeFee = round2(
      input.grossAmount * this.stripeFeePercent + this.stripeFeeFlat,
    );
    const net = round2(input.grossAmount - commission - stripeFee);

    const clearanceDays = await this.resolveClearanceDays(
      input.category,
      input.guideId,
    );
    const clearanceAt = addDays(input.clearanceAnchor, clearanceDays);

    const baseFields = {
      guideId: input.guideId,
      paymentId: input.paymentId,
      orderItemId: input.orderItemId,
      currency: 'USD',
      category: input.category,
      description: input.description,
      metadata: input.metadata,
    };

    // All 4 entries land in a single transaction so a partial fan-out is impossible.
    const entries = await this.prisma.$transaction([
      this.prisma.ledgerEntry.create({
        data: {
          ...baseFields,
          entryType: 'SALE',
          amount: input.grossAmount,
          status: 'AVAILABLE', // SALE rows are informational; status irrelevant for balance sums
        },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          ...baseFields,
          entryType: 'COMMISSION',
          amount: -commission,
          status: 'AVAILABLE',
        },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          ...baseFields,
          entryType: 'STRIPE_FEE',
          amount: -stripeFee,
          status: 'AVAILABLE',
        },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          ...baseFields,
          entryType: 'NET_PAYABLE',
          amount: net,
          status: 'PENDING_CLEARANCE',
          clearanceAt,
        },
      }),
    ]);

    // Cached aggregate is only rebuilt when v2 is the live path. During
    // shadow-write (LEDGER_V2_ENABLED=false), v1 still owns the cached
    // column — recomputing here would overwrite v1's correct value with
    // a v2 value that hasn't yet finished clearance.
    if (this.isV2Live()) {
      await this.recomputeCachedBalance(input.guideId);
    }

    this.logger.log(
      `Ledger fan-out for guide ${input.guideId} / payment ${input.paymentId}: ` +
        `gross=$${input.grossAmount} commission=$${commission} (${commissionPercent}%) ` +
        `stripeFee=$${stripeFee} net=$${net} clearsAt=${clearanceAt.toISOString()}`,
    );

    return { entries, net, commission, stripeFee };
  }

  isV2Live(): boolean {
    return String(this.config.get('LEDGER_V2_ENABLED', 'false')).toLowerCase() === 'true';
  }

  // ─── Refund / dispute reversal ─────────────────────────────────────────────

  /**
   * Reverses a payment's ledger fan-out for a refund (full or partial).
   *
   * Handling depends on the original NET_PAYABLE entry's current status:
   *   - PENDING_CLEARANCE: original flips to REVERSED, no clawback needed.
   *     Money never moved out of platform's float.
   *   - AVAILABLE (not yet paid out): a REFUND_REVERSAL entry with a negative
   *     amount lands as AVAILABLE; the next balance read shows the deduction.
   *   - PAID_OUT: same negative AVAILABLE entry; the guide's available balance
   *     can go negative. Locked decision #6 — no immediate clawback. Future
   *     earnings absorb the deficit before the next payout clears.
   *
   * Commission and Stripe fee entries are mirrored proportionally (refund of
   * 30% of the charge reverses 30% of the commission and 30% of the fee) so
   * the platform's P&L stays accurate.
   *
   * Idempotent: if a REFUND_REVERSAL with the same `reversalOfId` already
   * exists for the requested portion, returns without writing.
   */
  async writeRefundReversal(input: {
    paymentId: string;
    refundAmount: number; // Dollars actually refunded by Stripe (this slice).
    refundedFraction: number; // refundAmount / original payment.amount, 0..1.
    reason: 'REFUND' | 'DISPUTE';
    description?: string;
  }): Promise<{ reversedEntries: number }> {
    // Pull the original fan-out(s) for this payment. A multi-guide order
    // produces one set per OrderItem — refund logic per item is handled by
    // matching the refunded amount against the items' grosses, but the
    // simple case (one fan-out per payment) reverses pro-rata.
    const originalSets = await this.prisma.ledgerEntry.findMany({
      where: {
        paymentId: input.paymentId,
        entryType: { in: ['NET_PAYABLE', 'COMMISSION', 'STRIPE_FEE'] },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (originalSets.length === 0) {
      this.logger.warn(
        `writeRefundReversal: no ledger entries for payment ${input.paymentId} — skip`,
      );
      return { reversedEntries: 0 };
    }

    let reversedCount = 0;
    const guideIds = new Set<string>();

    for (const original of originalSets) {
      // Idempotency: skip if a reversal already exists for this exact
      // original entry at this exact fraction.
      const existing = await this.prisma.ledgerEntry.findFirst({
        where: {
          reversalOfId: original.id,
          entryType: 'REFUND_REVERSAL',
        },
      });
      if (existing) continue;

      // Pro-rata: a 30% refund reverses 30% of every entry.
      const reversedAmount = round2(
        Number(original.amount) * input.refundedFraction * -1,
      );

      // For NET_PAYABLE: determine status of the new entry based on the
      // original. PENDING_CLEARANCE original → mark original REVERSED, no
      // negative AVAILABLE entry needed. AVAILABLE / PAID_OUT original →
      // create AVAILABLE negative entry (clawback).
      let newStatus: 'REVERSED' | 'AVAILABLE';
      let updateOriginalToReversed = false;

      if (original.entryType === 'NET_PAYABLE') {
        if (original.status === 'PENDING_CLEARANCE') {
          newStatus = 'REVERSED';
          updateOriginalToReversed = true;
        } else {
          newStatus = 'AVAILABLE';
        }
      } else {
        // COMMISSION / STRIPE_FEE entries always live in AVAILABLE state
        // (they're informational); reversal mirrors them.
        newStatus = 'AVAILABLE';
      }

      await this.prisma.ledgerEntry.create({
        data: {
          guideId: original.guideId,
          entryType: 'REFUND_REVERSAL',
          amount: reversedAmount,
          currency: original.currency,
          status: newStatus,
          category: original.category,
          paymentId: original.paymentId,
          orderItemId: original.orderItemId,
          reversalOfId: original.id,
          description:
            input.description ??
            `${input.reason} reversal of ${original.entryType}`,
          metadata: {
            reason: input.reason,
            refundedFraction: input.refundedFraction,
            refundAmount: input.refundAmount,
          },
        },
      });

      if (updateOriginalToReversed) {
        await this.prisma.ledgerEntry.update({
          where: { id: original.id },
          data: { status: 'REVERSED' },
        });
      }

      reversedCount++;
      guideIds.add(original.guideId);
    }

    if (this.isV2Live()) {
      for (const guideId of guideIds) {
        await this.recomputeCachedBalance(guideId);
      }
    }

    this.logger.log(
      `Refund reversal for payment ${input.paymentId}: ${reversedCount} entries reversed (${input.reason}, fraction=${input.refundedFraction})`,
    );
    return { reversedEntries: reversedCount };
  }

  // ─── Commission lookup (per-guide override → platform default → env fallback) ─

  async resolveCommissionPercent(
    category: EarningCategory,
    guideId: string,
  ): Promise<number> {
    const now = new Date();
    // Per-guide override
    const guideRate = await this.prisma.commissionRate.findFirst({
      where: {
        category,
        guideId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (guideRate) return Number(guideRate.percent);

    // Platform default (guideId IS NULL)
    const defaultRate = await this.prisma.commissionRate.findFirst({
      where: {
        category,
        guideId: null,
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (defaultRate) return Number(defaultRate.percent);

    this.logger.warn(
      `No CommissionRate row for category ${category} (guide ${guideId}) — falling back to env (${this.fallbackCommissionPercent}%)`,
    );
    return this.fallbackCommissionPercent;
  }

  // ─── Clearance window lookup, with first-payout extended hold ──────────────

  async resolveClearanceDays(
    category: EarningCategory,
    guideId: string,
  ): Promise<number> {
    const rule = await this.prisma.clearanceRule.findUnique({
      where: { category },
    });
    const baseDays = rule?.days ?? defaultClearanceDays(category);

    // First-payout extended hold: +7 days for first 3 cleared transactions.
    const account = await this.prisma.payoutAccount.findUnique({
      where: { guideId },
      select: { completedTxnCount: true },
    });
    const bonus = (account?.completedTxnCount ?? 0) < 3 ? 7 : 0;

    return baseDays + bonus;
  }

  // ─── Balance reads ─────────────────────────────────────────────────────────

  /**
   * Available = sum of AVAILABLE-status entries that aren't already reserved
   * for an in-flight payout. Can go negative when a refund clawback arrives
   * after the original NET_PAYABLE was paid out.
   */
  async getAvailableBalance(guideId: string): Promise<number> {
    const result = await this.prisma.ledgerEntry.aggregate({
      where: {
        guideId,
        status: 'AVAILABLE',
        payoutRequestId: null,
        entryType: {
          in: ['NET_PAYABLE', 'REFUND_REVERSAL', 'PAYOUT_REVERSAL', 'ADJUSTMENT'],
        },
      },
      _sum: { amount: true },
    });
    return round2(Number(result._sum.amount ?? 0));
  }

  async getPendingBalance(guideId: string): Promise<number> {
    const result = await this.prisma.ledgerEntry.aggregate({
      where: {
        guideId,
        status: 'PENDING_CLEARANCE',
        entryType: 'NET_PAYABLE',
      },
      _sum: { amount: true },
    });
    return round2(Number(result._sum.amount ?? 0));
  }

  async getTotalEarned(guideId: string): Promise<number> {
    // Lifetime gross-net-paid: every NET_PAYABLE that ever cleared, minus
    // every reversal that ever applied. Excludes still-pending entries from
    // the count so this matches v1's "totalEarned" semantics.
    const result = await this.prisma.ledgerEntry.aggregate({
      where: {
        guideId,
        entryType: { in: ['NET_PAYABLE', 'REFUND_REVERSAL', 'ADJUSTMENT'] },
        status: { in: ['AVAILABLE', 'PAID_OUT'] },
      },
      _sum: { amount: true },
    });
    return round2(Number(result._sum.amount ?? 0));
  }

  async getTotalPaidOut(guideId: string): Promise<number> {
    const result = await this.prisma.ledgerEntry.aggregate({
      where: { guideId, entryType: 'PAYOUT', status: 'PAID_OUT' },
      _sum: { amount: true },
    });
    // PAYOUT entries are stored negative; flip sign for "totalPaidOut" display.
    return round2(Math.abs(Number(result._sum.amount ?? 0)));
  }

  // ─── Cached aggregate maintenance ──────────────────────────────────────────

  /**
   * Rebuilds PayoutAccount.{availableBalance, pendingBalance, totalEarned,
   * totalPaidOut} from the ledger. Cheap (4 indexed aggregates). Called after
   * every ledger write so v1's direct-column reads stay valid through cutover.
   */
  async recomputeCachedBalance(guideId: string): Promise<void> {
    const [available, pending, earned, paidOut] = await Promise.all([
      this.getAvailableBalance(guideId),
      this.getPendingBalance(guideId),
      this.getTotalEarned(guideId),
      this.getTotalPaidOut(guideId),
    ]);

    const account = await this.prisma.payoutAccount.findUnique({
      where: { guideId },
    });
    if (!account) {
      // Guide hasn't onboarded to Stripe Connect yet. Don't fabricate a row;
      // confirmPayment's createConnectOnboarding path is the only place that
      // should create PayoutAccount entries (it has the stripeAccountId).
      this.logger.warn(
        `recomputeCachedBalance: no PayoutAccount for guide ${guideId} — skip`,
      );
      return;
    }

    await this.prisma.payoutAccount.update({
      where: { guideId },
      data: {
        availableBalance: available,
        pendingBalance: pending,
        totalEarned: earned,
        totalPaidOut: paidOut,
      },
    });
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Hardcoded fallback if the clearance_rules row is somehow missing. Matches
 * locked decisions (2026-04-29) so behavior degrades safely rather than
 * crediting money instantly when the table is empty.
 */
function defaultClearanceDays(category: EarningCategory): number {
  switch (category) {
    case 'SERVICE':
      return 3;
    case 'EVENT':
      return 3;
    case 'TOUR':
      return 5;
    case 'PRODUCT':
      return 7;
  }
}
