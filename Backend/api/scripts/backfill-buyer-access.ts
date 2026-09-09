/**
 * Backfill buyer access for existing practitioners.
 *
 * Phase 1 of docs/practitioners-as-buyers.md. New practitioners get the buyer
 * role and profile at account creation (UsersService.ensureBuyerAccess); this
 * covers everyone who registered before that existed.
 *
 * Three modes, following the same shape as purge-demo-data.ts:
 *
 *   --mode=report    Read-only. Counts who would be granted what, and flags
 *                    anything that needs a human first. The default.
 *
 *   --mode=trial     Runs the whole grant inside a transaction against real
 *                    data, prints per-account results, then rolls back.
 *
 *   --mode=execute   The same work, committed. Requires --confirm=<db>.
 *
 * Usage:
 *   npm run buyer-access:report
 *   npm run buyer-access:trial
 *   npm run buyer-access:execute -- --confirm=<database-name>
 *
 * Re-runnable by design. Every account is checked for an existing role and an
 * existing profile before anything is written, so running it twice grants
 * nothing the second time — which matters because the safe way to roll this out
 * is in batches, re-running as more practitioners are verified.
 *
 * REVERSIBLE. Undoing this is `DELETE FROM user_roles WHERE role = 'SEEKER'`
 * for the affected users; the SeekerProfile rows can stay, since an empty
 * profile with no purchases is inert and keeping it preserves the ability to
 * re-grant without churning ids.
 *
 * Run scripts/audit-dual-role-accounts.ts FIRST. If accounts already hold both
 * roles, this script adopts their existing profiles rather than creating new
 * ones — but you want to know that before it happens, not after.
 */

import 'reflect-metadata';
import 'dotenv/config';
import { PrismaClient, Prisma, Role } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildPoolConfig } from '../src/common/db-ssl';

type Mode = 'report' | 'trial' | 'execute';

// Prisma 7 requires a driver adapter; see the note in
// audit-dual-role-accounts.ts. buildPoolConfig also supplies the RDS CA bundle.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

const pool = new Pool(buildPoolConfig(databaseUrl));
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

type Candidate = {
  userId: string;
  email: string;
  displayName: string;
  isActive: boolean;
  hasSeekerRole: boolean;
  seekerProfileId: string | null;
};

async function loadCandidates(): Promise<Candidate[]> {
  const guides = await prisma.guideProfile.findMany({
    select: {
      displayName: true,
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          roles: { select: { role: true } },
          seekerProfile: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return guides.map((g) => ({
    userId: g.user.id,
    email: g.user.email,
    displayName: g.displayName,
    isActive: g.user.isActive,
    hasSeekerRole: g.user.roles.some((r) => r.role === Role.SEEKER),
    seekerProfileId: g.user.seekerProfile?.id ?? null,
  }));
}

/**
 * The grant itself. Mirrors UsersService.ensureBuyerAccess deliberately — same
 * adopt-don't-replace rule for an existing profile, same upsert on the role —
 * so a backfilled account is indistinguishable from one created after the
 * change. It is duplicated rather than imported because this script talks to
 * Prisma directly and must run inside the caller's transaction (so trial mode
 * can roll the whole thing back).
 */
async function grant(tx: Prisma.TransactionClient, c: Candidate): Promise<'granted' | 'skipped'> {
  if (c.hasSeekerRole && c.seekerProfileId) return 'skipped';

  if (!c.seekerProfileId) {
    await tx.seekerProfile.create({ data: { userId: c.userId } });
  }
  await tx.userRole.upsert({
    where: { userId_role: { userId: c.userId, role: Role.SEEKER } },
    create: { userId: c.userId, role: Role.SEEKER },
    update: {},
  });
  return 'granted';
}

async function main() {
  const mode = (arg('mode') ?? 'report') as Mode;
  if (!['report', 'trial', 'execute'].includes(mode)) {
    throw new Error(`Unknown --mode=${mode}. Use report | trial | execute.`);
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  const dbName = dbUrl.split('/').pop()?.split('?')[0] ?? 'unknown';

  console.log(`Buyer-access backfill — mode=${mode} — database "${dbName}"`);
  console.log(new Date().toISOString());

  const candidates = await loadCandidates();
  if (candidates.length === 0) {
    console.log('\nNo practitioners on this database. Nothing to do.');
    return;
  }

  const needsBoth = candidates.filter((c) => !c.hasSeekerRole && !c.seekerProfileId);
  const needsRoleOnly = candidates.filter((c) => !c.hasSeekerRole && c.seekerProfileId);
  const needsProfileOnly = candidates.filter((c) => c.hasSeekerRole && !c.seekerProfileId);
  const alreadyDone = candidates.filter((c) => c.hasSeekerRole && c.seekerProfileId);

  console.log(`\n  practitioners total          ${candidates.length}`);
  console.log(`  need role + profile          ${needsBoth.length}`);
  console.log(`  need role, adopt profile     ${needsRoleOnly.length}`);
  console.log(`  have role, need profile      ${needsProfileOnly.length}`);
  console.log(`  already have buyer access    ${alreadyDone.length}`);
  console.log(`  inactive accounts included   ${candidates.filter((c) => !c.isActive).length}`);

  // These two groups are half-states nothing in the code produces. They mean
  // an admin edited roles by hand, or an earlier run died midway. Worth a human
  // glance before writing, even though the grant handles them correctly.
  if (needsRoleOnly.length > 0) {
    console.log('\n  Adopting existing seeker profiles (NOT creating new ones):');
    needsRoleOnly.forEach((c) => console.log(`    ${c.email}  profile=${c.seekerProfileId}`));
  }
  if (needsProfileOnly.length > 0) {
    console.log('\n  Hold the SEEKER role but have no profile — purchases would 403 today:');
    needsProfileOnly.forEach((c) => console.log(`    ${c.email}`));
  }

  const toGrant = candidates.filter((c) => !(c.hasSeekerRole && c.seekerProfileId));

  if (mode === 'report') {
    console.log(`\nReport only. ${toGrant.length} account(s) would be granted buyer access.`);
    console.log('Next: --mode=trial');
    return;
  }

  if (mode === 'execute') {
    const confirm = arg('confirm');
    if (confirm !== dbName) {
      throw new Error(
        `Refusing to write. Pass --confirm=${dbName} to confirm you mean this database.`,
      );
    }

    // Say plainly what this does, because it is easy to get wrong — and was
    // written down wrongly once already.
    //
    // PRACTITIONER_BUYER_ENABLED does NOT gate this. The flag gates
    // UsersService.ensureBuyerAccess, which is the automatic grant for accounts
    // created from here on. Nothing downstream consults it: the purchase
    // endpoints are guarded by @Roles(Role.SEEKER) and the checkout paths look
    // up a SeekerProfile. So the moment these rows are committed, these
    // practitioners can buy — flag or no flag.
    //
    // That makes this command the activation step for existing practitioners,
    // not a dry staging step before it.
    const flag = process.env.PRACTITIONER_BUYER_ENABLED === 'true' ? 'on' : 'OFF';
    console.log('');
    console.log('  ⚠  This grants buyer access for real. These practitioners will be able');
    console.log('     to purchase as soon as it commits. PRACTITIONER_BUYER_ENABLED does');
    console.log('     not gate it — that flag only controls the automatic grant for new');
    console.log(`     accounts, and is currently ${flag}.`);
    console.log('     To undo: DELETE the granted SEEKER rows (the profiles can stay).');
    console.log('');
  }

  let granted = 0;
  let skipped = 0;

  const run = async (tx: Prisma.TransactionClient) => {
    for (const c of toGrant) {
      const result = await grant(tx, c);
      if (result === 'granted') granted++;
      else skipped++;
      console.log(`  ${result === 'granted' ? 'GRANT ' : 'SKIP  '} ${c.email}  (${c.displayName})`);
    }
    if (mode === 'trial') {
      // Roll back by throwing — the only way to abort a Prisma interactive
      // transaction. Caught below and distinguished from a real failure.
      throw new RollbackSignal();
    }
  };

  console.log('');
  try {
    await prisma.$transaction(run, { timeout: 120_000 });
  } catch (e) {
    if (!(e instanceof RollbackSignal)) throw e;
  }

  console.log(`\n  granted  ${granted}`);
  console.log(`  skipped  ${skipped}`);

  if (mode === 'trial') {
    console.log('\nTrial complete — everything above was ROLLED BACK. Nothing was written.');
    console.log(`Next: --mode=execute --confirm=${dbName}`);
  } else {
    console.log('\nCommitted.');
    console.log('Practitioners can buy once PRACTITIONER_BUYER_ENABLED=true is set on the API.');
  }
}

class RollbackSignal extends Error {
  constructor() {
    super('trial rollback');
    this.name = 'RollbackSignal';
  }
}

main()
  .catch((e) => {
    console.error(`\n${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
