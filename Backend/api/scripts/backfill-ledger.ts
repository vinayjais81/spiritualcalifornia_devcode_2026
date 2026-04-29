/**
 * Backfill the v2 ledger from historical SUCCEEDED Payments.
 *
 * Two modes:
 *   --mode=verify   Replays without writing; computes the cached-balance the
 *                   ledger *would* produce per guide, compares to the current
 *                   PayoutAccount column, prints any drift. Read-only.
 *   --mode=write    Same replay, but actually writes ledger_entries rows.
 *                   Idempotent on (paymentId, guideId, orderItemId) so a
 *                   re-run is a no-op.
 *
 * Run after deploying P1–P8 with LEDGER_V2_ENABLED=false. Both modes leave
 * the v1 cached balance column alone — that flips at cutover when
 * LEDGER_V2_ENABLED=true and recomputeCachedBalance starts running.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-ledger.ts --mode=verify
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-ledger.ts --mode=write
 */

import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, EarningCategory } from '@prisma/client';

type Mode = 'verify' | 'write';

const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1];
const mode: Mode = modeArg === 'write' ? 'write' : 'verify';

const prisma = new PrismaClient();
// Flat ConfigService stand-in for env reads — avoids spinning up the full Nest app.
const config = {
  get(key: string, def?: string) {
    return process.env[key] ?? def;
  },
} as Pick<ConfigService, 'get'>;

const STRIPE_FEE_PCT = Number(config.get('STRIPE_PROCESSING_FEE_PERCENT', '2.9')) / 100;
const STRIPE_FEE_FLAT = Number(config.get('STRIPE_PROCESSING_FEE_FLAT', '0.30'));
const FALLBACK_COMMISSION = Number(config.get('STRIPE_PLATFORM_COMMISSION_PERCENT', '15'));

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

async function resolveCommissionPercent(category: EarningCategory, guideId: string): Promise<number> {
  const now = new Date();
  const guideRate = await prisma.commissionRate.findFirst({
    where: {
      category,
      guideId,
      effectiveFrom: { lte: now },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (guideRate) return Number(guideRate.percent);
  const defaultRate = await prisma.commissionRate.findFirst({
    where: {
      category,
      guideId: null,
      effectiveFrom: { lte: now },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return defaultRate ? Number(defaultRate.percent) : FALLBACK_COMMISSION;
}

async function resolveClearanceDays(category: EarningCategory): Promise<number> {
  const rule = await prisma.clearanceRule.findUnique({ where: { category } });
  if (rule) return rule.days;
  // Hardcoded defaults if the rules table is empty.
  return category === 'PRODUCT' ? 7 : category === 'TOUR' ? 5 : 3;
}

interface LineItem {
  guideId: string;
  paymentId: string;
  orderItemId?: string;
  grossAmount: number;
  category: EarningCategory;
  clearanceAnchor: Date;
  paymentSucceededAt: Date;
}

async function expandPaymentToLines(paymentId: string): Promise<LineItem[]> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: { include: { service: true, slot: true } },
      tourBooking: { include: { tour: true, departure: true } },
      ticketPurchase: { include: { tier: { include: { event: true } } } },
      order: {
        include: { items: { include: { product: true } } },
      },
    },
  });
  if (!payment) return [];

  const lines: LineItem[] = [];
  const succeededAt = payment.updatedAt;

  if (payment.bookingId && payment.booking) {
    lines.push({
      guideId: payment.booking.service.guideId,
      paymentId: payment.id,
      grossAmount: Number(payment.amount),
      category: 'SERVICE',
      clearanceAnchor: payment.booking.slot.endTime,
      paymentSucceededAt: succeededAt,
    });
  } else if (payment.tourBookingId && payment.tourBooking) {
    lines.push({
      guideId: payment.tourBooking.tour.guideId,
      paymentId: payment.id,
      grossAmount: Number(payment.amount),
      category: 'TOUR',
      clearanceAnchor: payment.tourBooking.departure?.endDate ?? succeededAt,
      paymentSucceededAt: succeededAt,
    });
  } else if (payment.ticketPurchaseId && payment.ticketPurchase) {
    lines.push({
      guideId: payment.ticketPurchase.tier.event.guideId,
      paymentId: payment.id,
      grossAmount: Number(payment.amount),
      category: 'EVENT',
      clearanceAnchor: payment.ticketPurchase.tier.event.endTime,
      paymentSucceededAt: succeededAt,
    });
  } else if (payment.orderId && payment.order) {
    for (const item of payment.order.items) {
      const isDigital = item.product.type === 'DIGITAL';
      const anchor = item.deliveredAt ?? (isDigital ? payment.order.paidAt ?? succeededAt : null);
      if (!anchor) continue; // Physical item not delivered → skip until delivery sets the anchor.
      lines.push({
        guideId: item.product.guideId,
        paymentId: payment.id,
        orderItemId: item.id,
        grossAmount: Number(item.unitPrice) * item.quantity,
        category: 'PRODUCT',
        clearanceAnchor: anchor,
        paymentSucceededAt: succeededAt,
      });
    }
  }

  return lines;
}

async function writeLineLedgerEntries(line: LineItem, dryRun: boolean): Promise<{ net: number; commission: number; stripeFee: number }> {
  // Idempotency: skip if NET_PAYABLE already exists.
  const existing = await prisma.ledgerEntry.findFirst({
    where: {
      paymentId: line.paymentId,
      guideId: line.guideId,
      orderItemId: line.orderItemId ?? null,
      entryType: 'NET_PAYABLE',
    },
  });
  if (existing) {
    return {
      net: Number(existing.amount),
      commission: 0,
      stripeFee: 0,
    };
  }

  const commissionPct = await resolveCommissionPercent(line.category, line.guideId);
  const commission = round2(line.grossAmount * (commissionPct / 100));
  const stripeFee = round2(line.grossAmount * STRIPE_FEE_PCT + STRIPE_FEE_FLAT);
  const net = round2(line.grossAmount - commission - stripeFee);

  const baseClearanceDays = await resolveClearanceDays(line.category);
  // No first-payout +7 bonus on backfill — historical txns predate the rule.
  const clearanceAt = addDays(line.clearanceAnchor, baseClearanceDays);

  // For backfill, status of NET_PAYABLE depends on whether clearance has
  // already passed: if past, AVAILABLE; if not, PENDING_CLEARANCE.
  const isPast = clearanceAt.getTime() < Date.now();
  const status = isPast ? 'AVAILABLE' : 'PENDING_CLEARANCE';

  if (dryRun) return { net, commission, stripeFee };

  const baseFields = {
    guideId: line.guideId,
    paymentId: line.paymentId,
    orderItemId: line.orderItemId,
    currency: 'USD',
    category: line.category,
    description: `Backfilled from payment ${line.paymentId}`,
  };

  await prisma.$transaction([
    prisma.ledgerEntry.create({
      data: { ...baseFields, entryType: 'SALE', amount: line.grossAmount, status: 'AVAILABLE' },
    }),
    prisma.ledgerEntry.create({
      data: { ...baseFields, entryType: 'COMMISSION', amount: -commission, status: 'AVAILABLE' },
    }),
    prisma.ledgerEntry.create({
      data: { ...baseFields, entryType: 'STRIPE_FEE', amount: -stripeFee, status: 'AVAILABLE' },
    }),
    prisma.ledgerEntry.create({
      data: {
        ...baseFields,
        entryType: 'NET_PAYABLE',
        amount: net,
        status,
        clearanceAt: isPast ? null : clearanceAt,
      },
    }),
  ]);

  return { net, commission, stripeFee };
}

async function backfillRefundsForPayment(paymentId: string, dryRun: boolean) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, amount: true, refundedAmount: true, status: true },
  });
  if (!payment) return;
  const refunded = Number(payment.refundedAmount ?? 0);
  if (refunded <= 0) return;

  const fraction = refunded / Number(payment.amount);
  // Skip if any REFUND_REVERSAL already exists for this payment.
  const existing = await prisma.ledgerEntry.findFirst({
    where: { paymentId, entryType: 'REFUND_REVERSAL' },
  });
  if (existing) return;

  const originals = await prisma.ledgerEntry.findMany({
    where: { paymentId, entryType: { in: ['NET_PAYABLE', 'COMMISSION', 'STRIPE_FEE'] } },
  });
  for (const original of originals) {
    const reversedAmount = round2(Number(original.amount) * fraction * -1);
    if (dryRun) continue;
    await prisma.ledgerEntry.create({
      data: {
        guideId: original.guideId,
        entryType: 'REFUND_REVERSAL',
        amount: reversedAmount,
        currency: original.currency,
        status: original.entryType === 'NET_PAYABLE' && original.status === 'PENDING_CLEARANCE' ? 'REVERSED' : 'AVAILABLE',
        category: original.category,
        paymentId,
        orderItemId: original.orderItemId,
        reversalOfId: original.id,
        description: `Backfilled refund reversal of ${original.entryType}`,
        metadata: { backfilled: true, refundedFraction: fraction },
      },
    });
    if (original.entryType === 'NET_PAYABLE' && original.status === 'PENDING_CLEARANCE') {
      await prisma.ledgerEntry.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
    }
  }
}

async function main() {
  console.log(`\n=== Ledger backfill — mode=${mode} ===\n`);
  const succeededPayments = await prisma.payment.findMany({
    where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Replaying ${succeededPayments.length} payment(s)…`);

  const expectedNetByGuide = new Map<string, number>();

  let processed = 0;
  for (const { id } of succeededPayments) {
    const lines = await expandPaymentToLines(id);
    for (const line of lines) {
      const { net } = await writeLineLedgerEntries(line, mode === 'verify');
      expectedNetByGuide.set(
        line.guideId,
        (expectedNetByGuide.get(line.guideId) ?? 0) + net,
      );
    }
    if (mode === 'write') await backfillRefundsForPayment(id, false);
    processed++;
    if (processed % 50 === 0) console.log(`  …${processed}/${succeededPayments.length}`);
  }

  console.log(`\nReplay complete (${processed} payments).`);

  // Verification: compare ledger SUM (or expectedNetByGuide for verify mode)
  // against PayoutAccount.{availableBalance + totalPaidOut}.
  // Note: v1 doesn't model refunds, so a perfect match isn't guaranteed for
  // accounts with refund history. Print drift, don't fail.
  console.log('\n=== Per-guide drift check ===');
  console.log('guideId, expected_net (from ledger replay), v1_balance (available + paidOut), drift');

  const accounts = await prisma.payoutAccount.findMany();
  let driftedAccounts = 0;
  for (const acc of accounts) {
    const v1Balance = round2(Number(acc.availableBalance) + Number(acc.totalPaidOut));
    const expected = round2(expectedNetByGuide.get(acc.guideId) ?? 0);
    const drift = round2(expected - v1Balance);
    if (Math.abs(drift) > 0.01) {
      driftedAccounts++;
      console.log(`  ${acc.guideId}, ${expected}, ${v1Balance}, ${drift}`);
    }
  }

  if (driftedAccounts === 0) {
    console.log('  ✓ no drift across all accounts');
  } else {
    console.log(`\n  ⚠ ${driftedAccounts} account(s) drifted.`);
    console.log('  Common causes: v1 absorbed Stripe fees (now passed through to guide),');
    console.log('  v1 did not reverse on refund (now does), or pending entries not yet cleared.');
    console.log('  Investigate before flipping LEDGER_V2_ENABLED=true.');
  }

  console.log('\n=== Done ===\n');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
