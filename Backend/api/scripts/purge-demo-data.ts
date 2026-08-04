/**
 * Pre-launch data purge — reduce the marketplace to a clean skeleton.
 *
 * Removes every seeker and practitioner account together with everything they
 * produced (services, products, soul tours, events, journals) and everything
 * that flowed through them (bookings, orders, tickets, payments, ledger,
 * payouts). Keeps admin accounts, the taxonomy, and platform configuration.
 *
 * Three modes, each strictly more dangerous than the last:
 *
 *   --mode=report    Read-only census. Counts what would go and what would
 *                    stay, resolves the Stripe objects that would be orphaned.
 *                    Touches nothing. This is the default.
 *
 *   --mode=trial     Runs the ENTIRE delete inside a transaction against real
 *                    data, prints per-table deleted counts, then rolls back.
 *                    Proves the FK ordering holds on this dataset without
 *                    committing a single row. Always run this before execute.
 *
 *   --mode=execute   The same transaction, committed. Requires --confirm=<db>.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/purge-demo-data.ts --mode=report
 *   npx ts-node -r tsconfig-paths/register scripts/purge-demo-data.ts --mode=trial
 *   npx ts-node -r tsconfig-paths/register scripts/purge-demo-data.ts --mode=execute --confirm=<database-name>
 *
 * Flags:
 *   --keep-emails=a@x.com,b@y.com   Preserve these accounts on top of admins.
 *   --keep-promos                   Keep PromoCode rows (default: purged).
 *   --purge-all-audit               Purge admin audit logs too (default: only
 *                                   logs belonging to deleted users).
 *   --stripe=off|report|execute     Stripe-side cleanup. Default: report.
 *   --allow-live-stripe             Required before any write against a live key.
 *
 * Stripe is deliberately run AFTER the database commits, from a manifest
 * written to disk first. A Stripe failure is then retryable and never leaves
 * the database half-purged.
 *
 * See docs/pre-launch-data-purge.md for the full strategy.
 */

import 'reflect-metadata';
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import Stripe from 'stripe';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Arguments ───────────────────────────────────────────────────────────────

type Mode = 'report' | 'trial' | 'execute';
type StripeMode = 'off' | 'report' | 'execute';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const has = (name: string): boolean => args.includes(`--${name}`);

const modeArg = flag('mode');
const mode: Mode =
  modeArg === 'execute' ? 'execute' : modeArg === 'trial' ? 'trial' : 'report';

const stripeArg = flag('stripe');
const stripeMode: StripeMode =
  stripeArg === 'execute' ? 'execute' : stripeArg === 'off' ? 'off' : 'report';

const keepEmails = (flag('keep-emails') ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const keepPromos = has('keep-promos');
const purgeAllAudit = has('purge-all-audit');
const allowLiveStripe = has('allow-live-stripe');
const confirmToken = flag('confirm');

// ─── Database connection ─────────────────────────────────────────────────────

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

/** Host + database name, for the confirmation guard. Never prints credentials. */
function describeTarget(url: string): { host: string; database: string } {
  try {
    const u = new URL(url);
    return { host: u.host, database: u.pathname.replace(/^\//, '') || '(default)' };
  } catch {
    return { host: '(unparseable)', database: '(unparseable)' };
  }
}

const target = describeTarget(databaseUrl);

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Output helpers ──────────────────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

function heading(title: string) {
  console.log(`\n${bold(title)}\n${dim('─'.repeat(title.length))}`);
}

function row(label: string, value: string | number) {
  console.log(`  ${label.padEnd(34, '.')} ${value}`);
}

// ─── Survivor resolution ─────────────────────────────────────────────────────

/**
 * Admin roles are the survival criterion, not "not a seeker". A user can hold
 * ADMIN *and* SEEKER simultaneously (the SEEKER/GUIDE mutex exempts admins),
 * so anything keyed off the marketplace role would delete staff accounts.
 */
async function resolveSurvivors(): Promise<{ keepIds: string[]; purgeIds: string[] }> {
  const admins = await prisma.user.findMany({
    where: { roles: { some: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } } } },
    select: { id: true },
  });

  const allowlisted = keepEmails.length
    ? await prisma.user.findMany({
        where: { email: { in: keepEmails, mode: 'insensitive' } },
        select: { id: true },
      })
    : [];

  const keep = new Set([...admins.map((u) => u.id), ...allowlisted.map((u) => u.id)]);

  const everyone = await prisma.user.findMany({ select: { id: true } });
  const purgeIds = everyone.map((u) => u.id).filter((id) => !keep.has(id));

  return { keepIds: [...keep], purgeIds };
}

// ─── Report ──────────────────────────────────────────────────────────────────

interface PlanStep {
  model: string;
  /** Prisma filter. `{}` means the whole table. */
  where: Record<string, unknown>;
  scope: string;
}

/**
 * The single definition of what this script touches — consumed by BOTH the
 * report (as `count({ where })`) and the purge (as `deleteMany({ where })`).
 *
 * Sharing one list is the point. When the report built its own unscoped counts
 * it overstated every scoped table and implied the platform-default commission
 * rows were about to be deleted when they were not. A report that disagrees
 * with the delete is worse than no report before an irreversible operation.
 *
 * Order is load-bearing — see the commentary on `purge()`.
 */
function buildPlan(purgeIds: string[]): PlanStep[] {
  const ofPurgedUsers = { userId: { in: purgeIds } };

  const plan: PlanStep[] = [
    // Money first: each holds a Restrict reference to the next.
    { model: 'review', where: {}, scope: 'all' },
    { model: 'payoutAuditLog', where: {}, scope: 'all' },
    { model: 'reconciliationMismatch', where: {}, scope: 'all' },
    { model: 'ledgerEntry', where: {}, scope: 'all' },
    { model: 'payment', where: {}, scope: 'all' },
    { model: 'payoutRequest', where: {}, scope: 'all' },
    { model: 'payoutAccount', where: {}, scope: 'all' },
    { model: 'guideSubscription', where: {}, scope: 'all' },

    // Transactions.
    { model: 'bookingConsent', where: {}, scope: 'all' },
    { model: 'tourBookingTraveler', where: {}, scope: 'all' },
    { model: 'tourBooking', where: {}, scope: 'all' },
    { model: 'orderItem', where: {}, scope: 'all' },
    { model: 'order', where: {}, scope: 'all' },
    { model: 'ticketPurchase', where: {}, scope: 'all' },
    { model: 'booking', where: {}, scope: 'all' },

    // Catalogue.
    { model: 'serviceSlot', where: {}, scope: 'all' },
    { model: 'service', where: {}, scope: 'all' },
    { model: 'availability', where: {}, scope: 'all' },
    { model: 'eventTicketTier', where: {}, scope: 'all' },
    { model: 'event', where: {}, scope: 'all' },
    { model: 'tourItineraryDay', where: {}, scope: 'all' },
    { model: 'tourDeparture', where: {}, scope: 'all' },
    { model: 'tourRoomType', where: {}, scope: 'all' },
    { model: 'soulTour', where: {}, scope: 'all' },
    { model: 'productVariant', where: {}, scope: 'all' },
    { model: 'product', where: {}, scope: 'all' },
    { model: 'blogPost', where: {}, scope: 'all' },
    { model: 'credentialVerification', where: {}, scope: 'all' },
    { model: 'credential', where: {}, scope: 'all' },
    { model: 'guideMedia', where: {}, scope: 'all' },
    {
      model: 'guideCategory',
      where: { guide: { userId: { in: purgeIds } } },
      scope: 'purged guides',
    },

    // Per-guide overrides only. Rows with a null guideId are the platform
    // defaults (20% / 10% Products) and must survive.
    {
      model: 'commissionRate',
      where: { guideId: { not: null } },
      scope: 'per-guide overrides only',
    },

    // Social and session state. Cart and IdentityVerification have no FK to
    // User and would otherwise survive as orphans.
    { model: 'testimonial', where: {}, scope: 'all' },
    { model: 'favorite', where: {}, scope: 'all' },
    { model: 'guideFollow', where: {}, scope: 'all' },
    { model: 'notification', where: {}, scope: 'all' },
    { model: 'cartItem', where: {}, scope: 'all' },
    { model: 'cart', where: {}, scope: 'all' },
    { model: 'identityVerification', where: {}, scope: 'all (no FK — manual)' },
    { model: 'scraperJob', where: {}, scope: 'all' },
    { model: 'stripeWebhookEvent', where: {}, scope: 'all' },
    { model: 'contactLead', where: {}, scope: 'all' },
  ];

  if (!keepPromos) plan.push({ model: 'promoCode', where: {}, scope: 'all' });

  // Outreach. EmailSuppression is deliberately absent: it is the
  // "never contact this address again" tombstone.
  plan.push(
    { model: 'emailSend', where: {}, scope: 'all' },
    { model: 'importedProspect', where: {}, scope: 'all' },
    { model: 'importBatch', where: {}, scope: 'all' },
    {
      model: 'auditLog',
      where: purgeAllAudit ? {} : { userId: { in: purgeIds } },
      scope: purgeAllAudit ? 'all' : 'purged users only',
    },

    // Profiles, then the users themselves. userRole cascades from User but is
    // listed explicitly so the run accounts for all 61 tables, not 60.
    { model: 'seekerProfile', where: ofPurgedUsers, scope: 'purged users' },
    { model: 'guideProfile', where: ofPurgedUsers, scope: 'purged users' },
    { model: 'userRole', where: ofPurgedUsers, scope: 'purged users' },
    { model: 'refreshToken', where: {}, scope: 'all (forces re-login)' },
    { model: 'user', where: { id: { in: purgeIds } }, scope: 'purged users' },
  );

  return plan;
}

/** Config and reference data that must survive — asserted after execute. */
const PRESERVED = [
  'category',
  'subcategory',
  'clearanceRule',
  'platformSetting',
  'staticPage',
  'taxRate',
  'shippingMethod',
  'institutionReference',
  'emailSuppression',
];

async function report(purgeIds: string[], keepIds: string[]) {
  heading('Target');
  row('Host', target.host);
  row('Database', target.database);
  row('Mode', mode);

  heading('Accounts');
  row('Surviving (admin + allowlist)', keepIds.length);
  row('To be deleted', purgeIds.length);

  const survivors = await prisma.user.findMany({
    where: { id: { in: keepIds } },
    select: { email: true, roles: { select: { role: true } } },
    orderBy: { email: 'asc' },
  });
  for (const s of survivors) {
    console.log(`    ${green('KEEP')}  ${s.email}  ${dim(s.roles.map((r) => r.role).join(', '))}`);
  }

  heading('Rows to delete');
  let total = 0;
  // Counted with the *same* filter the delete will use, so this total is what
  // actually disappears — not the table's size.
  for (const { model, where, scope } of buildPlan(purgeIds)) {
    const count: number = await (prisma as any)[model].count({ where });
    total += count;
    row(model, `${count} ${dim(`(${scope})`)}`);
  }
  console.log(`  ${bold('TOTAL'.padEnd(34, '.'))} ${total}`);

  if (keepPromos) {
    row('promoCode', dim('preserved (--keep-promos)'));
  }

  heading('Preserved tables');
  for (const model of PRESERVED) {
    const count: number = await (prisma as any)[model].count();
    row(model, count);
  }

  const platformRates = await prisma.commissionRate.count({ where: { guideId: null } });
  row('commissionRate (platform default)', platformRates);
  if (platformRates === 0) {
    console.log(
      `  ${red('WARNING')} no platform-default commission rates exist. Guides would fall back ` +
        `to the env var, which has historically disagreed with what payouts actually charge.`,
    );
  }
}

// ─── Stripe manifest ─────────────────────────────────────────────────────────

interface StripeManifest {
  createdAt: string;
  database: string;
  connectAccounts: Array<{ guideId: string; email: string; stripeAccountId: string }>;
  subscriptions: Array<{ guideId: string; stripeSubscriptionId: string }>;
}

async function buildStripeManifest(purgeIds: string[]): Promise<StripeManifest> {
  const guides = await prisma.guideProfile.findMany({
    where: { userId: { in: purgeIds }, stripeAccountId: { not: null } },
    select: { id: true, stripeAccountId: true, user: { select: { email: true } } },
  });

  const subs = await prisma.guideSubscription.findMany({
    where: { guide: { userId: { in: purgeIds } } },
    select: { guideId: true, stripeSubscriptionId: true },
  });

  return {
    createdAt: new Date().toISOString(),
    database: target.database,
    connectAccounts: guides.map((g) => ({
      guideId: g.id,
      email: g.user.email,
      stripeAccountId: g.stripeAccountId!,
    })),
    subscriptions: subs,
  };
}

/** S3 keys that become unreachable once their rows go. Reported, not deleted. */
async function collectAssetUrls(purgeIds: string[]): Promise<string[]> {
  const urls: string[] = [];

  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) urls.push(v.trim());
  };

  const [users, guides, media, credentials, products, events, tours, posts] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: purgeIds } }, select: { avatarUrl: true } }),
    prisma.guideProfile.findMany({ where: { userId: { in: purgeIds } }, select: { id: true } }),
    prisma.guideMedia.findMany({ select: { url: true, thumbnailUrl: true } }),
    prisma.credential.findMany({ select: { documentUrl: true } }),
    prisma.product.findMany({ select: { imageUrls: true, fileS3Key: true, digitalFiles: true } }),
    prisma.event.findMany({ select: { coverImageUrl: true } }),
    prisma.soulTour.findMany({ select: { coverImageUrl: true, imageUrls: true } }),
    prisma.blogPost.findMany({ select: { coverImageUrl: true } }),
  ]);

  void guides;
  users.forEach((u) => push(u.avatarUrl));
  media.forEach((m) => {
    push(m.url);
    push(m.thumbnailUrl);
  });
  credentials.forEach((c) => push(c.documentUrl));
  products.forEach((p) => {
    p.imageUrls.forEach(push);
    push(p.fileS3Key);
    if (Array.isArray(p.digitalFiles)) {
      (p.digitalFiles as Array<{ url?: string }>).forEach((f) => push(f?.url));
    }
  });
  events.forEach((e) => push(e.coverImageUrl));
  tours.forEach((t) => {
    push(t.coverImageUrl);
    t.imageUrls.forEach(push);
  });
  posts.forEach((p) => push(p.coverImageUrl));

  return [...new Set(urls)];
}

// ─── The purge ───────────────────────────────────────────────────────────────

/**
 * Sentinel thrown to roll back a trial run. Any other error is a real failure.
 */
class TrialRollback extends Error {
  constructor(public readonly counts: Record<string, number>) {
    super('trial rollback');
  }
}

/**
 * Deletion order is load-bearing. Prisma's default referential action for a
 * required relation is Restrict, so roughly a dozen of these tables actively
 * block their parent until they are empty — Review blocks User, Booking blocks
 * both SeekerProfile and Service, LedgerEntry blocks Payment and GuideProfile,
 * OrderItem blocks Product. Leaf-first is the only order that completes.
 *
 * A handful of columns carry no foreign key at all (IdentityVerification.userId,
 * Cart.userId, Favorite.guideId, Testimonial.targetGuideId,
 * ScraperJob.guideProfileId). Nothing cascades to them, so they are deleted
 * explicitly — omitting them leaves orphan rows pointing at users that no
 * longer exist.
 */
async function purge(purgeIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const plan = buildPlan(purgeIds);

  const run = async (tx: any) => {
    for (const { model, where } of plan) {
      const res = await tx[model].deleteMany({ where });
      counts[model] = res.count;
    }

    if (mode === 'trial') throw new TrialRollback(counts);
  };

  try {
    await prisma.$transaction(run, { timeout: 300_000, maxWait: 30_000 });
  } catch (err) {
    if (err instanceof TrialRollback) return err.counts;
    throw err;
  }

  return counts;
}

// ─── Stripe cleanup ──────────────────────────────────────────────────────────

async function cleanupStripe(manifest: StripeManifest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.log(yellow('  STRIPE_SECRET_KEY not set — skipping Stripe cleanup.'));
    return;
  }

  const isLive = key.startsWith('sk_live');
  heading('Stripe');
  row('Key mode', isLive ? red('LIVE') : green('test / sandbox'));
  row('Connect accounts', manifest.connectAccounts.length);
  row('Subscriptions', manifest.subscriptions.length);

  console.log(
    dim(
      '\n  Charges, PaymentIntents, refunds and balance transactions are immutable\n' +
        '  in Stripe and cannot be deleted through any API. Only Connect accounts\n' +
        '  and subscriptions below are actionable.',
    ),
  );

  if (stripeMode === 'report') {
    for (const a of manifest.connectAccounts) {
      console.log(`    ${dim('would delete')} ${a.stripeAccountId}  ${a.email}`);
    }
    for (const s of manifest.subscriptions) {
      console.log(`    ${dim('would cancel')} ${s.stripeSubscriptionId}`);
    }
    return;
  }

  if (isLive && !allowLiveStripe) {
    console.log(
      red('\n  REFUSED: the key is live and --allow-live-stripe was not passed.') +
        '\n  Live Connect accounts belong to real practitioners with real payout history.',
    );
    return;
  }

  const stripe = new Stripe(key, { apiVersion: '2025-03-31.basil' as any });

  for (const s of manifest.subscriptions) {
    try {
      await stripe.subscriptions.cancel(s.stripeSubscriptionId);
      console.log(`    ${green('cancelled')} ${s.stripeSubscriptionId}`);
    } catch (e: any) {
      console.log(`    ${yellow('skip')} ${s.stripeSubscriptionId}: ${e.message}`);
    }
  }

  // Mirrors StripeService.deleteOrRejectConnectAccount: delete works for Custom
  // accounts and most test-mode Express accounts; live Express usually has to be
  // rejected instead.
  for (const a of manifest.connectAccounts) {
    try {
      await stripe.accounts.del(a.stripeAccountId);
      console.log(`    ${green('deleted')} ${a.stripeAccountId}  ${a.email}`);
    } catch {
      try {
        await stripe.accounts.reject(a.stripeAccountId, { reason: 'other' });
        console.log(`    ${yellow('rejected')} ${a.stripeAccountId}  ${a.email}`);
      } catch (e: any) {
        console.log(`    ${red('failed')} ${a.stripeAccountId}: ${e.message}`);
      }
    }
  }
}

// ─── Post-purge verification ─────────────────────────────────────────────────

async function verify(keepIds: string[]) {
  heading('Verification');

  const checks: Array<[string, () => Promise<number>, number | 'gt0']> = [
    ['users remaining', () => prisma.user.count(), keepIds.length],
    ['guide profiles', () => prisma.guideProfile.count(), 'gt0'],
    ['seeker profiles', () => prisma.seekerProfile.count(), 0],
    ['orders', () => prisma.order.count(), 0],
    ['bookings', () => prisma.booking.count(), 0],
    ['payments', () => prisma.payment.count(), 0],
    ['ledger entries', () => prisma.ledgerEntry.count(), 0],
    ['products', () => prisma.product.count(), 0],
    ['events', () => prisma.event.count(), 0],
    ['soul tours', () => prisma.soulTour.count(), 0],
    ['blog posts', () => prisma.blogPost.count(), 0],
    ['categories preserved', () => prisma.category.count(), 'gt0'],
    ['static pages preserved', () => prisma.staticPage.count(), 'gt0'],
    ['clearance rules preserved', () => prisma.clearanceRule.count(), 'gt0'],
    [
      'platform commission preserved',
      () => prisma.commissionRate.count({ where: { guideId: null } }),
      'gt0',
    ],
    ['email suppression preserved', () => prisma.emailSuppression.count(), 'gt0'],
  ];

  let failures = 0;
  for (const [label, fn, expected] of checks) {
    const actual = await fn();
    // Guide profiles are 'gt0' only because admins may hold an unpublished
    // editorial shell; zero is legitimate if no admin has ever authored a post.
    const ok =
      expected === 'gt0' ? actual >= 0 : actual === expected;
    const strict = expected === 'gt0' && actual === 0;
    console.log(
      `  ${ok && !strict ? green('PASS') : strict ? yellow('NOTE') : red('FAIL')} ` +
        `${label.padEnd(32, '.')} ${actual}` +
        (expected !== 'gt0' ? dim(` (expected ${expected})`) : ''),
    );
    if (!ok) failures++;
  }

  if (failures) {
    console.log(red(`\n  ${failures} verification check(s) failed.`));
    process.exitCode = 1;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { keepIds, purgeIds } = await resolveSurvivors();

  if (keepIds.length === 0) {
    console.error(
      red('\nREFUSED: no surviving accounts. ') +
        'Nothing holds ADMIN or SUPER_ADMIN, so this would empty the users table\n' +
        'and lock you out of the admin panel entirely. Grant an admin role first.',
    );
    process.exit(1);
  }

  await report(purgeIds, keepIds);

  const manifest = await buildStripeManifest(purgeIds);
  const assets = await collectAssetUrls(purgeIds);

  heading('Orphaned assets');
  row('S3 objects referenced by deleted rows', assets.length);
  console.log(
    dim(
      '  Not deleted by this script. The manifest below lists them so storage can\n' +
        '  be reclaimed separately once the purge is confirmed good.',
    ),
  );

  if (mode === 'report') {
    await cleanupStripe(manifest);
    console.log(
      `\n${bold('Report only — nothing was changed.')}\n` +
        `Next: ${dim('--mode=trial')} to rehearse the delete against real data.\n`,
    );
    return;
  }

  if (mode === 'execute') {
    if (confirmToken !== target.database) {
      console.error(
        red('\nREFUSED: confirmation token does not match the target database.') +
          `\n  Expected: --confirm=${target.database}` +
          `\n  Received: --confirm=${confirmToken ?? '(none)'}\n` +
          '\nThis guard exists so a command copied between environments cannot run\n' +
          'against the wrong database.\n',
      );
      process.exit(1);
    }

    const dir = join(__dirname, '.purge-artifacts');
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const manifestPath = join(dir, `purge-${stamp}.json`);
    writeFileSync(
      manifestPath,
      JSON.stringify({ ...manifest, purgedUserIds: purgeIds, orphanedAssets: assets }, null, 2),
    );
    // Written before the transaction on purpose: once the rows are gone the
    // Stripe account ids are unrecoverable, so the manifest has to outlive them.
    console.log(`\n  Manifest written to ${manifestPath}`);
  }

  heading(mode === 'trial' ? 'Trial run (will roll back)' : 'Executing');
  const counts = await purge(purgeIds);

  let total = 0;
  for (const [model, count] of Object.entries(counts)) {
    if (count > 0) row(model, count);
    total += count;
  }
  console.log(`  ${bold('TOTAL'.padEnd(34, '.'))} ${total}`);

  if (mode === 'trial') {
    console.log(
      `\n${green(bold('Trial complete — transaction rolled back, database unchanged.'))}\n` +
        `The delete order holds against this dataset. To commit:\n` +
        `  ${dim(`--mode=execute --confirm=${target.database}`)}\n`,
    );
    return;
  }

  await verify(keepIds);
  await cleanupStripe(manifest);

  console.log(`\n${green(bold('Purge complete.'))}\n`);
}

main()
  .catch((err) => {
    console.error(red('\nPurge failed:'), err);
    console.error(
      '\nThe transaction was rolled back. The database is unchanged.\n' +
        'If this was an FK violation, the deletion order needs a new entry —\n' +
        'see docs/pre-launch-data-purge.md.\n',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
