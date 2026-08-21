/**
 * Production reference-data seed.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not `seed.ts`. That one creates demo guides, seekers, bookings,
 * orders and sandbox Stripe identifiers — exactly the data
 * scripts/purge-demo-data.ts exists to remove. Running it against a live
 * database wired to real Stripe keys would be worse than leaving the site
 * empty, so this file deliberately duplicates a little data rather than
 * importing from it.
 *
 * WHAT IT SEEDS
 * -------------
 *   1. One SUPER_ADMIN user            — nobody can administer the site without it
 *   2. Categories (9)                  — guide onboarding fails with an empty list
 *   3. CommissionRate rows             — what guides are actually charged
 *
 * All three are reference data: facts about how the platform is configured,
 * not sample content.
 *
 * IDEMPOTENT. Safe to re-run; it never overwrites an existing admin password
 * and never duplicates a category or a rate.
 *
 * Usage (on a production instance, via SSM):
 *   ADMIN_EMAIL=admin@spiritualcalifornia.com \
 *   ADMIN_PASSWORD='<strong password>' \
 *   npx ts-node -r tsconfig-paths/register prisma/seed-production.ts
 */
import 'dotenv/config';
import { PrismaClient, Role, EarningCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { buildPoolConfig } from '../src/common/db-ssl';
import * as bcrypt from 'bcrypt';

const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL));
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

/** Mirrors the nine cards the onboarding wizard renders. */
const CATEGORIES = [
  { slug: 'mind-healing', name: 'Mind Healing', description: 'Meditation, hypnotherapy, NLP and mindfulness practices', sortOrder: 1 },
  { slug: 'body-healing', name: 'Body Healing', description: 'Yoga, Reiki, acupuncture, and energy work', sortOrder: 2 },
  { slug: 'soul-travels', name: 'Soul Travels', description: 'Spiritual retreats and nature-based healing journeys', sortOrder: 3 },
  { slug: 'life-coaching', name: 'Life Coaching', description: 'Career, relationship, executive and purpose coaching', sortOrder: 4 },
  { slug: 'creative-arts', name: 'Creative Arts', description: 'Art therapy, music therapy and expressive arts', sortOrder: 5 },
  { slug: 'soul-spirit', name: 'Soul & Spirit', description: 'Shamanism, astrology, human design, ritual and ceremony', sortOrder: 6 },
  { slug: 'nutrition-food', name: 'Nutrition & Food', description: 'Ayurvedic nutrition, herbal medicine and functional food', sortOrder: 7 },
  { slug: 'integrative-health', name: 'Integrative Health', description: 'Naturopathy, functional medicine and holistic wellness', sortOrder: 8 },
  { slug: 'family-children', name: 'Family & Children', description: "Parenting guidance, children's wellness and family healing", sortOrder: 9 },
];

/**
 * Platform commission, per the v2.1 policy: 20% on services, events and
 * tours; 10% on products.
 *
 * These rows are the source of truth. STRIPE_PLATFORM_COMMISSION_PERCENT is
 * only a fallback — and a guide's fee display reads these rows, so an empty
 * table means guides are shown a rate the payout engine does not charge.
 */
const COMMISSION_RATES: Array<{ category: EarningCategory; percent: number }> = [
  { category: EarningCategory.SERVICE, percent: 20 },
  { category: EarningCategory.EVENT, percent: 20 },
  { category: EarningCategory.TOUR, percent: 20 },
  { category: EarningCategory.PRODUCT, percent: 10 },
];

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must both be set');
  }

  // The QA seed uses "12345678" for every account. That is fine for a demo
  // box and unacceptable for an environment holding real payment data, so
  // the password comes from the environment and a weak one is refused.
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters in production');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Never silently reset a password on re-run — that would let a repeat
    // invocation quietly change the credentials of a live admin account.
    console.log(`  admin already exists (${email}) — leaving password untouched`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: 'Super',
      lastName: 'Admin',
      // Pre-verified: there is no inbox to click a link in yet, and the
      // admin has to exist before email is proven working.
      isEmailVerified: true,
      isActive: true,
      roles: { create: [{ role: Role.SUPER_ADMIN }, { role: Role.ADMIN }] },
    },
  });

  console.log(`  created SUPER_ADMIN: ${email}`);
}

async function seedCategories() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      // Empty update: re-running must not revert an edit an admin has made
      // through the dashboard.
      update: {},
      create: { ...c, isActive: true },
    });
  }
  console.log(`  categories: ${await prisma.category.count()}`);
}

async function seedCommissionRates() {
  for (const r of COMMISSION_RATES) {
    // Platform default = guideId null. A per-guide override is a separate
    // row and takes precedence, so this must not disturb one.
    const existing = await prisma.commissionRate.findFirst({
      where: { category: r.category, guideId: null, effectiveUntil: null },
    });

    if (existing) {
      console.log(`  ${r.category}: rate already set (${existing.percent}%)`);
      continue;
    }

    await prisma.commissionRate.create({
      data: { category: r.category, guideId: null, percent: r.percent },
    });
    console.log(`  ${r.category}: ${r.percent}%`);
  }
}

async function main() {
  console.log('Production reference-data seed');
  console.log('  (reference data only — no demo guides, seekers or orders)\n');

  console.log('Admin user...');
  await seedAdmin();

  console.log('\nCategories...');
  await seedCategories();

  console.log('\nCommission rates...');
  await seedCommissionRates();

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
