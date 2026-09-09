/**
 * Dual-role account audit — read-only census before practitioners can buy.
 *
 * Phase 0 of docs/practitioners-as-buyers.md assumes a clean slate: no account
 * holds both GUIDE and SEEKER today, because guides.service.ts refuses the
 * combination at registration. That assumption is worth checking rather than
 * trusting, for one reason — the admin panel's role editor applies whatever
 * roles it is handed and never consults that rule. Any account an admin
 * edited could already hold both, silently half-working.
 *
 * If such accounts exist, the migration story changes: the Phase 1 backfill
 * must reconcile them instead of creating fresh profiles, and any self-dealing
 * they already committed predates the guards and needs deciding on by hand.
 *
 * This script therefore reports three things:
 *
 *   1. Accounts holding both marketplace roles, and whether each has the
 *      SeekerProfile the purchase paths require.
 *   2. Self-dealing already in the data — purchases and reviews where the
 *      buyer is the practitioner selling — across all four purchase paths.
 *      Nothing in the code produced these; a hit means an unknown path did.
 *   3. Practitioners who already have a SeekerProfile without the SEEKER role,
 *      which Phase 1 must adopt rather than duplicate.
 *
 * Writes nothing. Safe against production.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/audit-dual-role-accounts.ts
 *   npm run audit:dual-role
 *
 * Against production, run it through the read-only SSM path described in
 * project memory (payment-trace recipe) rather than pointing a local DATABASE_URL
 * at the prod instance.
 */

import 'reflect-metadata';
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildPoolConfig } from '../src/common/db-ssl';

// Prisma 7 requires a driver adapter — a bare `new PrismaClient()` throws
// PrismaClientInitializationError at construction, before any query runs.
// Matches how PrismaService builds the client in the running app, and how
// purge-demo-data.ts / backfill-ledger.ts do it. buildPoolConfig supplies the
// RDS CA bundle, without which this cannot connect to production at all.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

const pool = new Pool(buildPoolConfig(databaseUrl));
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function heading(text: string) {
  console.log(`\n${text}`);
  console.log('─'.repeat(text.length));
}

async function dualRoleAccounts() {
  heading('1. Accounts holding both GUIDE and SEEKER');

  // Two role rows for the same user. Done as a findMany + group rather than a
  // raw query so it stays readable and provider-agnostic.
  const marketplaceRoles = await prisma.userRole.findMany({
    where: { role: { in: [Role.GUIDE, Role.SEEKER] } },
    select: { userId: true, role: true },
  });

  const byUser = new Map<string, Set<Role>>();
  for (const r of marketplaceRoles) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, new Set());
    byUser.get(r.userId)!.add(r.role);
  }

  const dualIds = [...byUser.entries()]
    .filter(([, roles]) => roles.has(Role.GUIDE) && roles.has(Role.SEEKER))
    .map(([userId]) => userId);

  if (dualIds.length === 0) {
    console.log('  None. The clean-slate assumption holds.');
    return dualIds;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: dualIds } },
    select: {
      id: true,
      email: true,
      isActive: true,
      createdAt: true,
      seekerProfile: { select: { id: true } },
      guideProfile: { select: { id: true, displayName: true, isVerified: true, isPublished: true } },
    },
  });

  console.log(`  ${users.length} account(s) already hold both roles:\n`);
  for (const u of users) {
    console.log(`  ${u.email}`);
    console.log(`    user id        ${u.id}`);
    console.log(`    active         ${u.isActive}`);
    console.log(`    seeker profile ${u.seekerProfile ? u.seekerProfile.id : 'MISSING — purchases would 403'}`);
    console.log(
      `    guide profile  ${
        u.guideProfile
          ? `${u.guideProfile.displayName} (verified=${u.guideProfile.isVerified}, published=${u.guideProfile.isPublished})`
          : 'MISSING'
      }`,
    );
  }
  return dualIds;
}

async function existingSelfDealing() {
  heading('2. Self-dealing already present in the data');

  // Each purchase path, joined buyer-side (SeekerProfile.userId) against
  // seller-side (GuideProfile.userId). Compared on User.id in both directions —
  // profile ids live in different id spaces and would never match.
  const [bookings, tickets, tourBookings, orderItems, reviews] = await Promise.all([
    prisma.booking.findMany({
      select: {
        id: true,
        status: true,
        seeker: { select: { userId: true, user: { select: { email: true } } } },
        service: { select: { name: true, guide: { select: { userId: true } } } },
      },
    }),
    prisma.ticketPurchase.findMany({
      select: {
        id: true,
        status: true,
        seeker: { select: { userId: true, user: { select: { email: true } } } },
        tier: { select: { event: { select: { title: true, guide: { select: { userId: true } } } } } },
      },
    }),
    prisma.tourBooking.findMany({
      select: {
        id: true,
        status: true,
        seeker: { select: { userId: true, user: { select: { email: true } } } },
        tour: { select: { title: true, guide: { select: { userId: true } } } },
      },
    }),
    prisma.orderItem.findMany({
      select: {
        id: true,
        order: { select: { status: true, seeker: { select: { userId: true, user: { select: { email: true } } } } } },
        product: { select: { name: true, guide: { select: { userId: true } } } },
      },
    }),
    prisma.review.findMany({
      select: { id: true, authorId: true, guideId: true, rating: true, targetType: true },
    }),
  ]);

  const hits: string[] = [];

  for (const b of bookings) {
    if (b.seeker.userId === b.service.guide.userId) {
      hits.push(`  BOOKING  ${b.id}  ${b.seeker.user.email}  "${b.service.name}"  status=${b.status}`);
    }
  }
  for (const t of tickets) {
    if (t.seeker.userId === t.tier.event.guide.userId) {
      hits.push(`  TICKET   ${t.id}  ${t.seeker.user.email}  "${t.tier.event.title}"  status=${t.status}`);
    }
  }
  for (const tb of tourBookings) {
    if (tb.seeker.userId === tb.tour.guide.userId) {
      hits.push(`  TOUR     ${tb.id}  ${tb.seeker.user.email}  "${tb.tour.title}"  status=${tb.status}`);
    }
  }
  for (const oi of orderItems) {
    if (oi.order.seeker.userId === oi.product.guide.userId) {
      hits.push(
        `  PRODUCT  ${oi.id}  ${oi.order.seeker.user.email}  "${oi.product.name}"  order=${oi.order.status}`,
      );
    }
  }
  // Review.guideId is a User.id (not a profile id) — see the schema comment.
  for (const r of reviews) {
    if (r.authorId === r.guideId) {
      hits.push(`  REVIEW   ${r.id}  self-review  ${r.targetType}  rating=${r.rating}`);
    }
  }

  if (hits.length === 0) {
    console.log('  None. No purchase or review in the database is self-dealt.');
  } else {
    console.log(`  ${hits.length} row(s) — each needs a decision before Phase 1:\n`);
    hits.forEach((h) => console.log(h));
  }
}

async function orphanedSeekerProfiles() {
  heading('3. Practitioners with a SeekerProfile but no SEEKER role');

  const guideUserIds = (
    await prisma.userRole.findMany({ where: { role: Role.GUIDE }, select: { userId: true } })
  ).map((r) => r.userId);

  if (guideUserIds.length === 0) {
    console.log('  No practitioners on this database.');
    return;
  }

  const seekerRoleHolders = new Set(
    (
      await prisma.userRole.findMany({
        where: { role: Role.SEEKER, userId: { in: guideUserIds } },
        select: { userId: true },
      })
    ).map((r) => r.userId),
  );

  const profiles = await prisma.seekerProfile.findMany({
    where: { userId: { in: guideUserIds.filter((id) => !seekerRoleHolders.has(id)) } },
    select: { id: true, userId: true, user: { select: { email: true } } },
  });

  if (profiles.length === 0) {
    console.log('  None. Phase 1 creates every buyer profile from scratch.');
  } else {
    console.log(`  ${profiles.length} profile(s) the Phase 1 backfill must adopt, not recreate:\n`);
    profiles.forEach((p) => console.log(`  ${p.user.email}  seekerProfile=${p.id}`));
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const dbName = dbUrl.split('/').pop()?.split('?')[0] ?? 'unknown';
  console.log(`Dual-role audit — database "${dbName}" — ${new Date().toISOString()}`);
  console.log('Read-only. Nothing is written.');

  const dual = await dualRoleAccounts();
  await existingSelfDealing();
  await orphanedSeekerProfiles();

  heading('Verdict');
  if (dual.length === 0) {
    console.log('  Clean slate — Phase 1 can plan on creating buyer profiles fresh.');
  } else {
    console.log(`  ${dual.length} dual-role account(s) exist. Reconcile them before Phase 1.`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
