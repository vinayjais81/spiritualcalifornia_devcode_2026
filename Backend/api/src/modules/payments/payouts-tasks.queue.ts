import {
  Injectable, OnModuleInit, OnModuleDestroy, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from './ledger.service';
import { StripeService } from './stripe.service';
import { NotificationsService } from '../notifications/notifications.service';

const QUEUE_NAME = 'payouts-tasks';

const JOB_CLEARANCE = 'payout-clearance';
const JOB_RECONCILIATION = 'payout-reconciliation';
const JOB_INTEGRITY = 'payout-integrity-check';

// Every 15 minutes: flip PENDING_CLEARANCE entries past their clearanceAt
// over to AVAILABLE, recompute the cached balance, and bump the guide's
// completedTxnCount so the +7d first-3 hold lifts on schedule.
const CRON_CLEARANCE = '*/15 * * * *';

// 02:00 PT daily: pull Stripe balance transactions, match each to a ledger
// entry, surface unmatched rows in /admin/reconciliation.
const CRON_RECONCILIATION = '0 9 * * *'; // 09:00 UTC ≈ 02:00 PT (PDT)

// 03:00 PT daily: assert PayoutAccount cached columns equal SUM(ledger).
// Logs an error per drifted account; does not auto-correct.
const CRON_INTEGRITY = '0 10 * * *'; // 10:00 UTC ≈ 03:00 PT (PDT)

interface JobData { [key: string]: unknown; }

@Injectable()
export class PayoutsTasksQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutsTasksQueue.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string | undefined;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly stripe: StripeService,
    private readonly notifications: NotificationsService,
  ) {
    this.enabled = this.config.get<string>('PAYOUTS_TASKS_ENABLED', 'true') !== 'false';
    this.redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    this.redisPort = Number(this.config.get<string | number>('REDIS_PORT', 6379));
    this.redisPassword = this.config.get<string>('REDIS_PASSWORD');
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('[Queue] payouts-tasks queue disabled via PAYOUTS_TASKS_ENABLED=false');
      return;
    }

    const connection = {
      host: this.redisHost,
      port: this.redisPort,
      ...(this.redisPassword ? { password: this.redisPassword } : {}),
    };

    try {
      this.queue = new Queue(QUEUE_NAME, { connection });

      this.worker = new Worker<JobData>(
        QUEUE_NAME,
        async (job: Job<JobData>) => {
          this.logger.log(`[Queue] running job: ${job.name}`);
          if (job.name === JOB_CLEARANCE) {
            return this.runClearance();
          }
          if (job.name === JOB_RECONCILIATION) {
            return this.runReconciliation();
          }
          if (job.name === JOB_INTEGRITY) {
            return this.runIntegrityCheck();
          }
          this.logger.warn(`[Queue] unknown job name: ${job.name}`);
        },
        { connection, concurrency: 1 },
      );

      this.worker.on('completed', (job, result) =>
        this.logger.log(`[Queue] ${job.name} completed: ${JSON.stringify(result)}`),
      );
      this.worker.on('failed', (job, err) =>
        this.logger.error(`[Queue] ${job?.name} failed: ${err.message}`),
      );

      await this.queue.add(
        JOB_CLEARANCE,
        {},
        {
          repeat: { pattern: CRON_CLEARANCE },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      );
      await this.queue.add(
        JOB_RECONCILIATION,
        {},
        {
          repeat: { pattern: CRON_RECONCILIATION },
          removeOnComplete: { count: 30 },
          removeOnFail: { count: 30 },
        },
      );
      await this.queue.add(
        JOB_INTEGRITY,
        {},
        {
          repeat: { pattern: CRON_INTEGRITY },
          removeOnComplete: { count: 30 },
          removeOnFail: { count: 30 },
        },
      );

      this.logger.log(
        `[Queue] payouts-tasks worker started — clearance(${CRON_CLEARANCE}), reconciliation(${CRON_RECONCILIATION}), integrity(${CRON_INTEGRITY})`,
      );
    } catch (err: any) {
      this.logger.error(
        `[Queue] failed to start payouts-tasks queue: ${err.message}. ` +
        `Clearance will not run until Redis is available.`,
      );
      this.queue = null;
      this.worker = null;
    }
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close();
      await this.queue?.close();
    } catch (err: any) {
      this.logger.error(`[Queue] error closing payouts-tasks queue: ${err.message}`);
    }
  }

  // ─── Job: clearance ────────────────────────────────────────────────────────

  /**
   * Flips PENDING_CLEARANCE → AVAILABLE for entries whose clearanceAt has
   * passed, skipping guides on admin hold. After flipping, recomputes the
   * cached PayoutAccount balance and bumps completedTxnCount so the first-
   * payout +7d extension lifts after the 3rd cleared NET_PAYABLE.
   *
   * Idempotent — running twice flips zero rows the second time.
   */
  private async runClearance() {
    const now = new Date();

    // 1. Find candidate entries (PENDING_CLEARANCE, past clearance, not held).
    const candidates = await this.prisma.ledgerEntry.findMany({
      where: {
        status: 'PENDING_CLEARANCE',
        entryType: 'NET_PAYABLE',
        clearanceAt: { not: null, lte: now },
        guide: {
          payoutAccount: { holdActive: false },
        },
      },
      select: { id: true, guideId: true, amount: true, paymentId: true },
    });

    if (candidates.length === 0) {
      return { cleared: 0 };
    }

    // 2. Flip them in a single update.
    await this.prisma.ledgerEntry.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { status: 'AVAILABLE' },
    });

    // 3. Recompute completedTxnCount per affected guide as a TOTAL, not an
    // increment. A transaction = one successful payment; a multi-item
    // product order with items that clear in different cron runs must
    // still count as one transaction. Increment-based bookkeeping over-
    // counts in that case, so we re-derive from the ledger:
    //
    //   completedTxnCount = COUNT(DISTINCT paymentId)
    //                       WHERE entryType='NET_PAYABLE'
    //                         AND status IN ('AVAILABLE','PAID_OUT')
    //
    // Idempotent: re-running clearance never inflates the count.
    const affectedGuideIds = Array.from(new Set(candidates.map((c) => c.guideId)));
    for (const guideId of affectedGuideIds) {
      const cleared = await this.prisma.ledgerEntry.findMany({
        where: {
          guideId,
          entryType: 'NET_PAYABLE',
          status: { in: ['AVAILABLE', 'PAID_OUT'] },
          paymentId: { not: null },
        },
        select: { paymentId: true },
        distinct: ['paymentId'],
      });
      await this.prisma.payoutAccount.update({
        where: { guideId },
        data: { completedTxnCount: cleared.length },
      });
    }

    // 4. Recompute cached balance per affected guide. Only kicks in once
    // LEDGER_V2_ENABLED=true; pre-cutover this is a no-op (v1 still owns
    // the cached column).
    if (this.ledger.isV2Live()) {
      for (const guideId of affectedGuideIds) {
        await this.ledger.recomputeCachedBalance(guideId);
      }
    }

    // 5. Notify each affected guide of the cleared total. Sum amounts that
    // cleared in this run per-guide for a single email rather than spamming
    // one per ledger entry.
    const clearedByGuide = new Map<string, number>();
    for (const e of candidates) {
      clearedByGuide.set(
        e.guideId,
        (clearedByGuide.get(e.guideId) ?? 0) + Number(e.amount),
      );
    }

    for (const [guideId, amount] of clearedByGuide.entries()) {
      try {
        const guide = await this.prisma.guideProfile.findUnique({
          where: { id: guideId },
          select: {
            displayName: true,
            user: { select: { id: true, email: true } },
          },
        });
        if (!guide?.user?.email || !guide.user.id) continue;
        await this.notifications.notifyPayoutEarningsCleared({
          userId: guide.user.id,
          email: guide.user.email,
          guideName: guide.displayName,
          amount: `$${amount.toFixed(2)}`,
          earningsUrl: `${this.config.get('FRONTEND_URL')}/guide/dashboard/earnings`,
        });
      } catch (err: any) {
        this.logger.error(
          `[clearance] earnings-cleared notify failed for guide ${guideId}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `[clearance] flipped ${candidates.length} entries across ${affectedGuideIds.length} guides`,
    );
    return { cleared: candidates.length, guides: affectedGuideIds.length };
  }

  // ─── Job: reconciliation ───────────────────────────────────────────────────

  /**
   * Pulls Stripe balance_transactions since the last successful run, matches
   * each one against our ledger, and surfaces unmatched rows in the
   * reconciliation_mismatches table for ops to triage.
   *
   * Only WRITES the mismatch record — never auto-corrects. This is the
   * tripwire that catches webhook drops, manual Stripe-dashboard refunds,
   * and Connect rounding drift.
   */
  private async runReconciliation() {
    // Window: last 36 hours (overlapping window so a missed run still
    // catches the prior day). Idempotent on stripeBalanceTxnId.
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
    let txns;
    try {
      txns = await this.stripe.listBalanceTransactions({ since });
    } catch (err: any) {
      this.logger.error(`[reconciliation] Stripe pull failed: ${err.message}`);
      throw err;
    }

    let unmatched = 0;
    let matched = 0;

    for (const txn of txns) {
      const stripeAmountDollars = txn.amount / 100;
      const expectedType = mapStripeTypeToLedgerEntryType(txn.type);

      let isMatched = false;
      let paymentId: string | null = null;

      if (txn.source && typeof txn.source === 'string') {
        // Resolve the source — for charges, source is a charge ID.
        // For refunds, source is a refund ID. For transfers, source is a transfer ID.
        if (txn.type === 'charge') {
          // Match against Payment.stripePaymentIntentId via Charge.payment_intent.
          try {
            const charge = await this.stripe.retrieveCharge(txn.source);
            if (charge?.payment_intent && typeof charge.payment_intent === 'string') {
              const payment = await this.prisma.payment.findUnique({
                where: { stripePaymentIntentId: charge.payment_intent },
              });
              if (payment) {
                paymentId = payment.id;
                // For a charge, expect a SALE entry to exist for this payment.
                const sale = await this.prisma.ledgerEntry.findFirst({
                  where: { paymentId: payment.id, entryType: 'SALE' },
                });
                isMatched = !!sale;
              }
            }
          } catch (err: any) {
            this.logger.warn(
              `[reconciliation] could not resolve charge ${txn.source}: ${err.message}`,
            );
          }
        } else if (txn.type === 'refund') {
          // Match against any Payment whose stripeRefundId === txn.source.
          const payment = await this.prisma.payment.findFirst({
            where: { stripeRefundId: txn.source },
          });
          if (payment) {
            paymentId = payment.id;
            const reversal = await this.prisma.ledgerEntry.findFirst({
              where: {
                paymentId: payment.id,
                entryType: 'REFUND_REVERSAL',
              },
            });
            isMatched = !!reversal;
          }
        } else if (txn.type === 'transfer') {
          // Match against PayoutRequest.stripePayoutId.
          const payout = await this.prisma.payoutRequest.findFirst({
            where: { stripePayoutId: txn.source },
          });
          isMatched = !!payout;
        }
      }

      if (isMatched) {
        matched++;
        continue;
      }

      // Unknown / unmatched — record the mismatch (idempotent on stripeBalanceTxnId).
      try {
        await this.prisma.reconciliationMismatch.upsert({
          where: { stripeBalanceTxnId: txn.id },
          update: {},
          create: {
            stripeBalanceTxnId: txn.id,
            stripeType: txn.type,
            stripeAmount: stripeAmountDollars,
            stripeCurrency: (txn.currency ?? 'usd').toUpperCase(),
            stripeCreatedAt: new Date(txn.created * 1000),
            expectedLedgerEntryType: expectedType,
            paymentId,
            details: {
              source: txn.source ?? null,
              description: txn.description ?? null,
              fee: txn.fee,
              net: txn.net,
            },
          },
        });
        unmatched++;
      } catch (err: any) {
        this.logger.error(
          `[reconciliation] failed to record mismatch for ${txn.id}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `[reconciliation] window ${since.toISOString()} → now: ${txns.length} txns, ${matched} matched, ${unmatched} unmatched`,
    );
    return { total: txns.length, matched, unmatched };
  }

  // ─── Job: integrity check ──────────────────────────────────────────────────

  /**
   * Asserts every PayoutAccount's cached column equals the ledger's SUM.
   * Logs an error per drifted account but does not auto-correct — the human
   * needs to investigate (likely a missing webhook or an out-of-band action).
   *
   * Only runs when LEDGER_V2_ENABLED=true; pre-cutover, v1 still owns the
   * column and there's nothing meaningful to compare.
   */
  private async runIntegrityCheck() {
    if (!this.ledger.isV2Live()) {
      this.logger.log('[integrity] LEDGER_V2_ENABLED=false — skipping');
      return { skipped: true };
    }

    const accounts = await this.prisma.payoutAccount.findMany({
      select: { id: true, guideId: true, availableBalance: true, pendingBalance: true, totalEarned: true, totalPaidOut: true },
    });

    let drifted = 0;
    for (const acc of accounts) {
      const [available, pending, earned, paidOut] = await Promise.all([
        this.ledger.getAvailableBalance(acc.guideId),
        this.ledger.getPendingBalance(acc.guideId),
        this.ledger.getTotalEarned(acc.guideId),
        this.ledger.getTotalPaidOut(acc.guideId),
      ]);
      const cents = (n: number) => Math.round(n * 100);
      const drifts = {
        available: cents(available) - cents(Number(acc.availableBalance)),
        pending: cents(pending) - cents(Number(acc.pendingBalance)),
        earned: cents(earned) - cents(Number(acc.totalEarned)),
        paidOut: cents(paidOut) - cents(Number(acc.totalPaidOut)),
      };
      const anyDrift = Object.values(drifts).some((d) => d !== 0);
      if (anyDrift) {
        drifted++;
        this.logger.error(
          `[integrity] DRIFT for guide ${acc.guideId}: ledger=(${available}, ${pending}, ${earned}, ${paidOut}) cached=(${acc.availableBalance}, ${acc.pendingBalance}, ${acc.totalEarned}, ${acc.totalPaidOut}) drifts=${JSON.stringify(drifts)} — investigate`,
        );
      }
    }

    this.logger.log(
      `[integrity] checked ${accounts.length} accounts, ${drifted} drifted`,
    );
    return { checked: accounts.length, drifted };
  }
}

function mapStripeTypeToLedgerEntryType(stripeType: string): string | null {
  switch (stripeType) {
    case 'charge':
      return 'SALE';
    case 'refund':
      return 'REFUND_REVERSAL';
    case 'transfer':
      return 'PAYOUT';
    case 'application_fee':
    case 'application_fee_refund':
      return 'COMMISSION';
    default:
      return null;
  }
}
