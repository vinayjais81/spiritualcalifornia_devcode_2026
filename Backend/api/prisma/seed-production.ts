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
 *   3. Subcategories (39)              — the specialisations under each category
 *   4. CommissionRate rows             — what guides are actually charged
 *   5. ShippingMethod rows             — physical checkout is unusable without one
 *   6. TaxRate rows                    — an empty table silently charges $0 tax
 *
 * All six are reference data: facts about how the platform is configured,
 * not sample content.
 *
 * 5 and 6 were missing when production went live, and the pair is a good
 * illustration of why "reference data" deserves a seed of its own. With no
 * ShippingMethod rows the shop checkout simply stopped — visible, if
 * confusing, since the UI rendered the empty list as "Loading shipping
 * options…" forever. With no TaxRate rows `calculateTax` returns
 * `{ rate: 0, name: 'No tax' }` and the order completes at the wrong total,
 * server-side, with nothing to see. The blocking failure is the kind one
 * notices; the silent one is the kind that reaches an accountant.
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

/**
 * The specialisations offered under each category, keyed by category slug.
 *
 * Without these the onboarding picker renders nine category cards with nothing
 * underneath, and every practitioner invents their own taxonomy through the
 * "custom subcategory" path — which still works, but leaves the practitioner
 * filters with nothing curated to match on and a mess to reconcile later.
 *
 * NOTE the explicit `isApproved: true` in the seeder. The column defaults to
 * FALSE, and `listCategories` filters on `isApproved: true` — so seeding
 * without setting it creates all 39 rows and still serves an empty list. That
 * failure looks exactly like the seed not having run.
 */
const SUBCATEGORIES: Record<string, Array<{ slug: string; name: string }>> = {
  'mind-healing': [
    { slug: 'breathwork', name: 'Breathwork' },
    { slug: 'hypnotherapy', name: 'Hypnotherapy' },
    { slug: 'meditation', name: 'Meditation' },
    { slug: 'mindfulness-coaching', name: 'Mindfulness Coaching' },
    { slug: 'nlp', name: 'NLP' },
  ],
  'body-healing': [
    { slug: 'acupuncture', name: 'Acupuncture' },
    { slug: 'energy-healing', name: 'Energy Healing' },
    { slug: 'massage-bodywork', name: 'Massage & Bodywork' },
    { slug: 'qigong', name: 'QiGong' },
    { slug: 'reiki', name: 'Reiki' },
    { slug: 'somatic-therapy', name: 'Somatic Therapy' },
    { slug: 'sound-healing', name: 'Sound Healing' },
    { slug: 'yoga', name: 'Yoga' },
  ],
  'soul-travels': [
    { slug: 'nature-based-healing', name: 'Nature-Based Healing' },
    { slug: 'spiritual-retreats', name: 'Spiritual Retreats' },
  ],
  'life-coaching': [
    { slug: 'career-coaching', name: 'Career Coaching' },
    { slug: 'executive-coaching', name: 'Executive Coaching' },
    { slug: 'purpose-coaching', name: 'Purpose Coaching' },
    { slug: 'relationship-coaching', name: 'Relationship Coaching' },
  ],
  'creative-arts': [
    { slug: 'art-therapy', name: 'Art Therapy' },
    { slug: 'dance-movement-therapy', name: 'Dance Movement Therapy' },
    { slug: 'music-therapy', name: 'Music Therapy' },
  ],
  'soul-spirit': [
    { slug: 'astrology', name: 'Astrology' },
    { slug: 'end-of-life-doula', name: 'End-of-Life Doula' },
    { slug: 'human-design', name: 'Human Design' },
    { slug: 'plant-medicine-integration', name: 'Plant Medicine Integration' },
    { slug: 'ritual-ceremony', name: 'Ritual & Ceremony' },
    { slug: 'shamanism', name: 'Shamanism' },
  ],
  'nutrition-food': [
    { slug: 'ayurvedic-nutrition', name: 'Ayurvedic Nutrition' },
    { slug: 'functional-nutrition', name: 'Functional Nutrition' },
    { slug: 'herbal-medicine', name: 'Herbal Medicine' },
  ],
  'integrative-health': [
    { slug: 'functional-medicine', name: 'Functional Medicine' },
    { slug: 'homeopathy', name: 'Homeopathy' },
    { slug: 'naturopathy', name: 'Naturopathy' },
    { slug: 'tibetan-medicine', name: 'Tibetan Medicine' },
  ],
  'family-children': [
    { slug: 'birth-doula', name: 'Birth Doula' },
    { slug: 'childrens-wellness', name: "Children's Wellness" },
    { slug: 'family-healing', name: 'Family Healing' },
    { slug: 'parenting-guidance', name: 'Parenting Guidance' },
  ],
};

/**
 * Shipping options offered at checkout.
 *
 * The ids are derived from the name rather than left to cuid() so that every
 * environment refers to the same method by the same id — an Order stores
 * `shippingMethodId`, and a support question about a QA order should not need
 * a translation table to answer against production.
 */
const SHIPPING_METHODS = [
  { name: 'Standard Shipping', description: 'Delivered via USPS Ground', price: 12.0, estimatedDaysMin: 7, estimatedDaysMax: 14, sortOrder: 0 },
  { name: 'Express Shipping', description: 'Priority delivery via USPS/UPS', price: 28.0, estimatedDaysMin: 3, estimatedDaysMax: 5, sortOrder: 1 },
  { name: 'International Priority', description: 'International delivery via DHL/FedEx', price: 45.0, estimatedDaysMin: 5, estimatedDaysMax: 10, sortOrder: 2 },
];

/** `Standard Shipping` → `standard-shipping`. Matches the ids QA already uses. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Sales tax by state.
 *
 * These are STATE-LEVEL BASE RATES, carried over from the QA seed so the two
 * environments agree. They are deliberately simple and they are not tax
 * advice: California alone has district rates that push the real figure above
 * the 8.63% below, and seeding a state here asserts that the platform collects
 * tax there — which is a nexus question, not a technical one.
 *
 * Seeded anyway because the alternative is what production shipped with: an
 * empty table, every order at $0 tax, and no signal that anything is wrong.
 * Being approximately right is recoverable; being silently zero is not. Have
 * these reviewed, and edit them in the admin rather than here.
 */
const TAX_RATES = [
  { state: 'CA', rate: 0.0863, name: 'California State Tax' },
  { state: 'NY', rate: 0.08, name: 'New York State Tax' },
  { state: 'TX', rate: 0.0625, name: 'Texas State Tax' },
  { state: 'FL', rate: 0.06, name: 'Florida State Tax' },
  { state: 'WA', rate: 0.065, name: 'Washington State Tax' },
  { state: 'CO', rate: 0.029, name: 'Colorado State Tax' },
  { state: 'AZ', rate: 0.056, name: 'Arizona State Tax' },
  { state: 'OR', rate: 0.0, name: 'Oregon (No Sales Tax)' },
  { state: 'NV', rate: 0.0685, name: 'Nevada State Tax' },
  { state: 'HI', rate: 0.04, name: 'Hawaii General Excise Tax' },
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

async function seedSubcategories() {
  for (const [categorySlug, subs] of Object.entries(SUBCATEGORIES)) {
    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) {
      // Should be impossible — seedCategories runs first — but a silent skip
      // here would be indistinguishable from the category having no children.
      console.log(`  WARNING: category '${categorySlug}' not found, skipped ${subs.length} subcategories`);
      continue;
    }

    for (const s of subs) {
      await prisma.subcategory.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug: s.slug } },
        // Empty update: never re-approve or rename one an admin has changed.
        update: {},
        // isApproved must be set explicitly — it defaults to false and
        // listCategories only returns approved rows. isCustom stays false:
        // these are the curated list, not something a practitioner typed.
        create: { categoryId: category.id, slug: s.slug, name: s.name, isApproved: true, isCustom: false },
      });
    }
  }
  console.log(`  subcategories: ${await prisma.subcategory.count({ where: { isApproved: true } })} approved`);
}

async function seedShippingMethods() {
  for (const m of SHIPPING_METHODS) {
    await prisma.shippingMethod.upsert({
      where: { id: slug(m.name) },
      // Empty update, like categories: a re-run must not revert a price an
      // admin has changed. Correcting a rate is an admin action, not a
      // redeploy.
      update: {},
      create: { id: slug(m.name), ...m, isActive: true },
    });
  }
  console.log(`  shipping methods: ${await prisma.shippingMethod.count({ where: { isActive: true } })} active`);
}

async function seedTaxRates() {
  for (const t of TAX_RATES) {
    await prisma.taxRate.upsert({
      where: { state_country: { state: t.state, country: 'US' } },
      update: {},
      create: { state: t.state, country: 'US', rate: t.rate, name: t.name, isActive: true },
    });
  }
  console.log(`  tax rates: ${await prisma.taxRate.count({ where: { isActive: true } })} active`);
}

async function main() {
  console.log('Production reference-data seed');
  console.log('  (reference data only — no demo guides, seekers or orders)\n');

  console.log('Admin user...');
  await seedAdmin();

  console.log('\nCategories...');
  await seedCategories();

  // After categories: each subcategory is looked up by its parent's slug.
  console.log('\nSubcategories...');
  await seedSubcategories();

  console.log('\nCommission rates...');
  await seedCommissionRates();

  console.log('\nShipping methods...');
  await seedShippingMethods();

  console.log('\nTax rates...');
  await seedTaxRates();

  // Both lists are read through CacheService with a 1-hour TTL, and getOrSet
  // caches whatever the fetcher returned — including the empty array this
  // seed exists to fix. Restarting the API does NOT help: the value is in
  // Redis, not in the process. Say so here, because the alternative is
  // concluding the seed silently failed.
  console.log('\nDone.');
  console.log('\nNOTE: /checkout/shipping-methods and /checkout/tax-rates are cached');
  console.log('      for 1 hour. Clear the cached empties or the site will keep');
  console.log('      serving them:');
  console.log('        redis-cli -u "$REDIS_URL" DEL checkout:shipping checkout:tax');
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
