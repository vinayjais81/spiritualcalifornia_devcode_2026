/**
 * Import the editorial content library into blog_posts.
 *
 * Reads Markdown + YAML frontmatter from the client's content package and
 * upserts each article as an EDITORIAL BlogPost. The .md files stay the source
 * of truth: re-running after a content edit updates in place rather than
 * duplicating, keyed on `sourcePath` with `contentHash` deciding what changed.
 *
 * Three modes, mirroring scripts/purge-demo-data.ts:
 *
 *   --mode=report    Parse, validate, resolve everything and print what would
 *                    happen. Touches nothing. Default.
 *   --mode=trial     Runs the full upsert inside a transaction, then rolls back.
 *                    Proves the writes succeed against real data without
 *                    committing.
 *   --mode=execute   The same transaction, committed.
 *
 * Usage:
 *   npm run articles:report -- --content="D:/path/to/spiritual-california-content"
 *   npm run articles:trial   -- --content="..."
 *   npm run articles:execute -- --content="..." --confirm=<database-name>
 *
 * Flags:
 *   --content=<dir>       Root of the content package (contains articles/,
 *                         what-to-do/, clinic/). Required.
 *   --author-email=<a@b>  Account to attribute the import to. Defaults to the
 *                         single SUPER_ADMIN when there is exactly one.
 *   --preserve-dates      Honour each article's own publishedAt instead of
 *                         stamping today. The client chose today's date
 *                         (2026-08-10); this flag restores the original
 *                         2.5-year editorial calendar.
 *   --draft               Import unpublished, for staging a review pass.
 *
 * See docs/journal-content-library-strategy.md.
 */

import 'reflect-metadata';
import 'dotenv/config';
import { PrismaClient, AuthorKind, ArticleSeries, ContentFormat, Escalation } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { buildPoolConfig } from '../src/common/db-ssl';
import { load as parseYaml } from 'js-yaml';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';

// ─── Arguments ───────────────────────────────────────────────────────────────

type Mode = 'report' | 'trial' | 'execute';

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const has = (n: string) => args.includes(`--${n}`);

const modeArg = flag('mode');
const mode: Mode = modeArg === 'execute' ? 'execute' : modeArg === 'trial' ? 'trial' : 'report';
/**
 * Defaults to the in-repo copy, which is the source of truth — see
 * content/LOCAL-FIXES.md. Pass --content to import from the client's delivered
 * package directly instead.
 */
const contentRoot = flag('content') ?? join(__dirname, '..', '..', '..', 'content');
const authorEmail = flag('author-email');
const preserveDates = has('preserve-dates');
const asDraft = has('draft');
const confirmToken = flag('confirm');
/**
 * Re-import articles whose source file has not changed.
 *
 * Needed whenever something outside the .md file changes the derived row —
 * moving the images to S3 being the first case. The hash only covers the
 * source, so without this the importer would report 124 unchanged and quietly
 * do nothing.
 */
const force = has('force');
/** Keep the local /images/... paths instead of rewriting to S3. */
const localImages = has('local-images');

/**
 * Where hero images are served from. Mirrors UploadService.getFileUrl so the
 * CloudFront-or-S3 precedence is identical, and reuses the same env vars —
 * a new one would be stripped by env.validation.ts until declared there.
 */
const IMAGE_BASE = (() => {
  if (localImages) return '';
  const cf = process.env.AWS_CLOUDFRONT_URL;
  if (cf) return cf.replace(/\/$/, '');
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION ?? 'us-west-1';
  return bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : '';
})();

/**
 * `/images/journal/x.webp` → `<base>/article-images/journal/x.webp`, matching
 * the keys upload-article-images.ts writes. Falls back to the original path
 * when S3 is unconfigured, so an unconfigured environment still renders from
 * `public/` rather than pointing at a host that does not exist.
 */
function resolveHeroImage(heroImage: string): string {
  if (!IMAGE_BASE || !heroImage.startsWith('/images/')) return heroImage;
  return `${IMAGE_BASE}/${heroImage.replace(/^\/images\//, 'article-images/')}`;
}

if (!contentRoot) {
  console.error('\n--content=<dir> is required (root of the content package).\n');
  process.exit(1);
}

// ─── Series definitions ──────────────────────────────────────────────────────

/**
 * All three series render under one flat /journal/{slug} namespace — the client
 * dropped the per-series URL prefixes on 2026-08-10. `series` is still recorded
 * so admin filtering and future listing tabs have something to group on.
 */
const SERIES = [
  { dir: 'articles', series: ArticleSeries.JOURNAL, linkPrefix: '/journal' },
  { dir: 'what-to-do', series: ArticleSeries.WHAT_TO_DO, linkPrefix: '/what-to-do' },
  { dir: 'clinic', series: ArticleSeries.CLINIC, linkPrefix: '/clinic' },
] as const;

/**
 * Proposed mapping from the article's editorial `category` to a marketplace
 * category slug. Drives the "find matching practitioners" CTA.
 *
 * These are PROPOSED, not authoritative — the content uses 27 distinct labels
 * against a 9-category taxonomy, and several are clinical topics the
 * marketplace has no equivalent for. Anything mapping to null keeps its
 * `categoryLabel` for display but gets no practitioner CTA. The report prints
 * the full resolution so an editor can correct it before execute.
 */
const CATEGORY_MAP: Record<string, string | null> = {
  'Mind Healing': 'mind-healing',
  'Body Healing': 'body-healing',
  'Life Coaching': 'life-coaching',
  'Soul Travels': 'soul-travels',
  Meditation: 'mind-healing',
  Breathwork: 'mind-healing',
  'Emotion Regulation': 'mind-healing',
  'Trauma Treatment': 'mind-healing',
  'Depression Treatment': 'mind-healing',
  'Sleep Treatment': 'mind-healing',
  'OCD Treatment': 'mind-healing',
  'Relationship Therapy': 'mind-healing',
  'How Therapy Works': 'mind-healing',
  Hypnotherapy: 'mind-healing',
  'Art Therapy': 'creative-arts',
  'Music Therapy': 'creative-arts',
  'Dance Movement Therapy': 'creative-arts',
  'Sound Healing': 'soul-spirit',
  'Energy Healing': 'soul-spirit',
  Reiki: 'soul-spirit',
  Acupuncture: 'integrative-health',
  'Traditional Chinese Medicine': 'integrative-health',
  Ayurveda: 'integrative-health',
  'Biological Treatment': 'integrative-health',
  QiGong: 'body-healing',
  Yoga: 'body-healing',
  'Getting Care': null,
};

// ─── Output helpers ──────────────────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const heading = (t: string) => console.log(`\n${bold(t)}\n${dim('─'.repeat(t.length))}`);
const row = (l: string, v: string | number) => console.log(`  ${l.padEnd(34, '.')} ${v}`);

// ─── Database ────────────────────────────────────────────────────────────────

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
const targetDb = (() => {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, '') || '(default)';
  } catch {
    return '(unparseable)';
  }
})();

const pool = new Pool(buildPoolConfig(databaseUrl));
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ─── Parsing ─────────────────────────────────────────────────────────────────

interface Article {
  sourcePath: string;
  series: ArticleSeries;
  slug: string;
  frontmatter: Record<string, any>;
  body: string;
  contentHash: string;
  /** Position in the original editorial calendar, 1-based. */
  calendarIndex: number;
  originalPublishedAt: Date;
  errors: string[];
  warnings: string[];
}

/** Splits `---\n<yaml>\n---\n<body>`. */
function splitFrontmatter(raw: string): { fm: Record<string, any>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) throw new Error('no YAML frontmatter block');
  const fm = parseYaml(match[1]) as Record<string, any>;
  if (!fm || typeof fm !== 'object') throw new Error('frontmatter did not parse to an object');
  return { fm, body: match[2] };
}

/**
 * Cheap "are these nearly the same slug" test — shared token overlap rather
 * than true edit distance. Good enough to surface a typo'd URL as a suggestion;
 * it never decides anything on its own.
 */
function levenshteinish(a: string, b: string): boolean {
  const ta = new Set(a.split('-'));
  const tb = b.split('-');
  const shared = tb.filter((t) => ta.has(t)).length;
  return shared >= Math.max(2, Math.min(ta.size, tb.length) - 1);
}

const REQUIRED_ALL = [
  'title',
  'slug',
  'dek',
  'author',
  'publishedAt',
  'readTime',
  'heroImage',
  'heroAlt',
  'category',
  'tags',
  'healthAdjacent',
];

/**
 * Validation is conditional per series, never global.
 *
 * `evidenceTier` is required for Journal and Clinic but **deliberately absent**
 * from all 41 What To Do articles — the tier concept was withdrawn from that
 * series because those pieces are read mid-problem on a phone, where a
 * strength-of-evidence label is noise. Failing the build on its absence there
 * would be wrong.
 */
function validate(a: Article, allSlugs: Set<string>) {
  const fm = a.frontmatter;

  for (const key of REQUIRED_ALL) {
    if (fm[key] === undefined || fm[key] === null || fm[key] === '') {
      a.errors.push(`missing required field: ${key}`);
    }
  }

  if (fm.slug !== a.slug) {
    a.errors.push(`slug "${fm.slug}" does not match filename stem "${a.slug}"`);
  }

  // heroImage filename must equal the slug — this is what makes the image
  // pipeline self-wiring.
  if (typeof fm.heroImage === 'string') {
    const imgStem = basename(fm.heroImage).replace(/\.(webp|png|jpe?g)$/i, '');
    if (imgStem !== a.slug) {
      a.errors.push(`heroImage "${fm.heroImage}" does not match slug "${a.slug}"`);
    }
  }

  if (a.series === ArticleSeries.WHAT_TO_DO) {
    if (fm.evidenceTier !== undefined) {
      a.errors.push('evidenceTier must be absent from What To Do articles');
    }
  } else if (!fm.evidenceTier) {
    a.errors.push('missing required field: evidenceTier');
  }

  if (fm.evidenceTier && !['A', 'B', 'C', 'D'].includes(String(fm.evidenceTier))) {
    a.errors.push(`evidenceTier "${fm.evidenceTier}" is not one of A|B|C|D`);
  }

  if (fm.escalation && !['none', 'practitioner', 'clinician', 'urgent'].includes(String(fm.escalation))) {
    a.errors.push(`escalation "${fm.escalation}" is not a recognised value`);
  }

  if (!(fm.category in CATEGORY_MAP)) {
    a.warnings.push(`category "${fm.category}" has no mapping — no practitioner CTA`);
  }

  // Every internal link must land on an article that exists, or the reader
  // hits a 404 mid-sentence.
  for (const m of a.body.matchAll(/\]\((\/(?:journal|clinic|what-to-do)\/([a-z0-9-]+))\)/g)) {
    if (!allSlugs.has(m[2])) {
      // Offer the closest real slug. Broken links here have so far been URL
      // typos against an article that does exist, so the near-miss is usually
      // the fix — see content/LOCAL-FIXES.md.
      const near = [...allSlugs].filter(
        (s) => s.includes(m[2]) || m[2].includes(s) || levenshteinish(s, m[2]),
      );
      a.errors.push(
        `internal link to unknown article: ${m[1]}` +
          (near.length ? ` — did you mean /journal/${near[0]}?` : ''),
      );
    }
  }

  for (const s of (fm.routesTo ?? []) as string[]) {
    if (!allSlugs.has(s)) a.warnings.push(`routesTo references unknown slug: ${s}`);
  }
}

/**
 * Collapses the three series prefixes onto /journal.
 *
 * All 124 slugs were verified globally unique, so this is lossless — a link to
 * /clinic/erp-for-ocd and a link to /journal/erp-for-ocd can only ever mean the
 * same article. Without this, 159 of the 255 internal cross-links would 404.
 */
function rewriteLinks(body: string): { body: string; rewritten: number } {
  let rewritten = 0;
  const out = body.replace(/\]\(\/(clinic|what-to-do)\/([a-z0-9-]+)\)/g, (_m, _prefix, slug) => {
    rewritten++;
    return `](/journal/${slug})`;
  });
  return { body: out, rewritten };
}

function loadArticles(): Article[] {
  const all: Article[] = [];

  for (const { dir, series } of SERIES) {
    const abs = join(contentRoot!, dir);
    if (!existsSync(abs)) {
      console.error(red(`content directory not found: ${abs}`));
      process.exit(1);
    }
    for (const file of readdirSync(abs).filter((f) => f.endsWith('.md')).sort()) {
      const raw = readFileSync(join(abs, file), 'utf8');
      const slug = file.replace(/\.md$/, '');
      try {
        const { fm, body } = splitFrontmatter(raw);
        all.push({
          sourcePath: `${dir}/${file}`,
          series,
          slug,
          frontmatter: fm,
          body,
          contentHash: createHash('sha256').update(raw).digest('hex'),
          calendarIndex: 0,
          originalPublishedAt: new Date(fm.publishedAt ?? 0),
          errors: [],
          warnings: [],
        });
      } catch (e: any) {
        all.push({
          sourcePath: `${dir}/${file}`,
          series,
          slug,
          frontmatter: {},
          body: '',
          contentHash: '',
          calendarIndex: 0,
          originalPublishedAt: new Date(0),
          errors: [`parse failed: ${e.message}`],
          warnings: [],
        });
      }
    }
  }

  // sortOrder follows the editorial calendar, not the filesystem. The client
  // asked for every article to carry the import date, which makes publishedAt
  // identical across the library and useless as a sort key — this is what keeps
  // the intended reading order and makes pagination deterministic.
  all
    .filter((a) => !isNaN(a.originalPublishedAt.getTime()))
    .sort((x, y) => x.originalPublishedAt.getTime() - y.originalPublishedAt.getTime())
    .forEach((a, i) => {
      a.calendarIndex = i + 1;
    });

  return all;
}

// ─── Import ──────────────────────────────────────────────────────────────────

class TrialRollback extends Error {
  constructor(public readonly stats: Stats) {
    super('trial rollback');
  }
}

interface Stats {
  created: number;
  updated: number;
  unchanged: number;
  linksRewritten: number;
}

function toEscalation(v: unknown): Escalation | null {
  if (typeof v !== 'string') return null;
  const map: Record<string, Escalation> = {
    none: Escalation.NONE,
    practitioner: Escalation.PRACTITIONER,
    clinician: Escalation.CLINICIAN,
    urgent: Escalation.URGENT,
  };
  return map[v] ?? null;
}

async function importArticles(
  articles: Article[],
  authorUserId: string,
  categoryIds: Map<string, string>,
): Promise<Stats> {
  const stats: Stats = { created: 0, updated: 0, unchanged: 0, linksRewritten: 0 };
  const importedAt = new Date();

  const run = async (tx: any) => {
    for (const a of articles) {
      const fm = a.frontmatter;
      const { body, rewritten } = rewriteLinks(a.body);
      stats.linksRewritten += rewritten;

      const existing = await tx.blogPost.findUnique({
        where: { sourcePath: a.sourcePath },
        select: { id: true, contentHash: true },
      });

      if (existing?.contentHash === a.contentHash && !force) {
        stats.unchanged++;
        continue;
      }

      const mappedSlug = CATEGORY_MAP[fm.category];
      const publishedAt = preserveDates ? a.originalPublishedAt : importedAt;

      const data = {
        authorKind: AuthorKind.EDITORIAL,
        // Editorial articles belong to the publication, not a practitioner.
        guideId: null,
        authorUserId,
        series: a.series,
        contentFormat: ContentFormat.MARKDOWN,
        title: String(fm.title),
        slug: a.slug,
        content: body,
        // `dek` is the authored standfirst; excerpt stays the derived field the
        // listing components already read.
        dek: fm.dek ? String(fm.dek) : null,
        excerpt: fm.dek ? String(fm.dek) : null,
        coverImageUrl: fm.heroImage ? resolveHeroImage(String(fm.heroImage)) : null,
        heroAlt: fm.heroAlt ? String(fm.heroAlt) : null,
        authorName: fm.author ? String(fm.author) : null,
        authorRole: fm.authorRole ? String(fm.authorRole) : null,
        readTime: fm.readTime ? String(fm.readTime) : null,
        categoryLabel: fm.category ? String(fm.category) : null,
        categoryId: mappedSlug ? (categoryIds.get(mappedSlug) ?? null) : null,
        relatedModalities: (fm.relatedModalities ?? []) as string[],
        healthAdjacent: Boolean(fm.healthAdjacent),
        sourcesCount: typeof fm.sourcesCount === 'number' ? fm.sourcesCount : null,
        evidenceTier: fm.evidenceTier ? String(fm.evidenceTier) : null,
        situation: fm.situation ? String(fm.situation) : null,
        timeToTry: fm.timeToTry ? String(fm.timeToTry) : null,
        primaryTechnique: fm.primaryTechnique ? String(fm.primaryTechnique) : null,
        routesTo: (fm.routesTo ?? []) as string[],
        escalation: toEscalation(fm.escalation),
        verifiedAsOf: fm.verifiedAsOf ? new Date(String(fm.verifiedAsOf)) : null,
        reviewCadence: fm.reviewCadence ? String(fm.reviewCadence) : null,
        tags: (fm.tags ?? []) as string[],
        sortOrder: a.calendarIndex,
        isPublished: !asDraft,
        publishedAt: asDraft ? null : publishedAt,
        sourcePath: a.sourcePath,
        contentHash: a.contentHash,
      };

      if (existing) {
        await tx.blogPost.update({ where: { id: existing.id }, data });
        stats.updated++;
      } else {
        await tx.blogPost.create({ data });
        stats.created++;
      }
    }

    if (mode === 'trial') throw new TrialRollback(stats);
  };

  try {
    await prisma.$transaction(run, { timeout: 300_000, maxWait: 30_000 });
  } catch (e) {
    if (e instanceof TrialRollback) return e.stats;
    throw e;
  }
  return stats;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  heading('Target');
  row('Database', targetDb);
  row('Content root', contentRoot!);
  row('Mode', mode);
  row('Dates', preserveDates ? 'original editorial calendar' : 'import date (client decision)');
  row('State', asDraft ? 'draft' : 'published');
  row('Hero images', IMAGE_BASE ? `${IMAGE_BASE}/article-images/…` : dim('local /images/… (S3 not configured)'));
  if (force) row('Force', yellow('re-importing unchanged articles'));

  const articles = loadArticles();
  const allSlugs = new Set(articles.map((a) => a.slug));
  articles.forEach((a) => validate(a, allSlugs));

  heading('Parsed');
  for (const { dir, series } of SERIES) {
    row(dir, articles.filter((a) => a.series === series).length);
  }
  row('TOTAL', articles.length);

  // A slug collision would be silently destructive: the second article would
  // overwrite the first at the same URL.
  const dupes = [...allSlugs].filter((s) => articles.filter((a) => a.slug === s).length > 1);
  if (dupes.length) {
    console.log(red(`\n  DUPLICATE SLUGS: ${dupes.join(', ')}`));
  }

  const errored = articles.filter((a) => a.errors.length);
  const warned = articles.filter((a) => a.warnings.length);

  heading('Validation');
  row('Clean', articles.length - errored.length);
  row('With errors', errored.length ? red(String(errored.length)) : '0');
  row('With warnings', warned.length ? yellow(String(warned.length)) : '0');

  for (const a of errored) {
    console.log(`  ${red('ERROR')} ${a.sourcePath}`);
    a.errors.forEach((e) => console.log(`         ${e}`));
  }
  for (const a of warned.slice(0, 15)) {
    console.log(`  ${yellow('WARN')}  ${a.sourcePath}`);
    a.warnings.forEach((w) => console.log(`         ${w}`));
  }
  if (warned.length > 15) console.log(dim(`  … and ${warned.length - 15} more with warnings`));

  // Link rewrite preview
  const totalRewrites = articles.reduce((n, a) => n + rewriteLinks(a.body).rewritten, 0);
  heading('Link rewriting');
  row('/clinic + /what-to-do → /journal', totalRewrites);
  console.log(
    dim('  Lossless: all slugs are globally unique, so a prefix carries no meaning.'),
  );

  // Category resolution
  const categories = await prisma.category.findMany({ select: { id: true, slug: true, name: true } });
  const categoryIds = new Map(categories.map((c) => [c.slug, c.id]));

  heading('Category resolution (proposed — review before execute)');
  const labelCounts = new Map<string, number>();
  articles.forEach((a) => {
    const l = String(a.frontmatter.category ?? '(none)');
    labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
  });
  let unmapped = 0;
  for (const [label, count] of [...labelCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const target = CATEGORY_MAP[label];
    const resolved = target ? categoryIds.get(target) : undefined;
    if (target && !resolved) {
      console.log(`  ${red('MISSING')} ${label.padEnd(30)} → ${target} ${dim('(no such category)')}`);
    } else if (!target) {
      unmapped += count;
      console.log(`  ${yellow('EDITORIAL-ONLY')} ${label.padEnd(23)} ${dim(`${count} article(s), no CTA`)}`);
    } else {
      console.log(`  ${green('OK')} ${label.padEnd(30)} → ${target} ${dim(`(${count})`)}`);
    }
  }
  if (unmapped) row('Articles with no practitioner CTA', unmapped);

  // Author
  const author = authorEmail
    ? await prisma.user.findFirst({ where: { email: { equals: authorEmail, mode: 'insensitive' } } })
    : await prisma.user.findFirst({
        where: { roles: { some: { role: 'SUPER_ADMIN' } } },
        orderBy: { createdAt: 'asc' },
      });

  heading('Attribution');
  if (!author) {
    console.log(red('  No author resolved. Pass --author-email=<address>.'));
    process.exit(1);
  }
  row('authorUserId', `${author.email} ${dim(author.id)}`);
  console.log(dim('  Recorded on every imported post; guideId stays null (editorial).'));

  if (errored.length) {
    console.log(
      red(`\nREFUSED: ${errored.length} article(s) failed validation.`) +
        '\nFix the content or the mapping and re-run. Nothing was written.\n',
    );
    process.exit(1);
  }

  if (mode === 'report') {
    console.log(`\n${bold('Report only — nothing was changed.')}`);
    console.log(`Next: ${dim('--mode=trial')} to rehearse the writes.\n`);
    return;
  }

  if (mode === 'execute' && confirmToken !== targetDb) {
    console.error(
      red('\nREFUSED: confirmation token does not match the target database.') +
        `\n  Expected: --confirm=${targetDb}\n  Received: --confirm=${confirmToken ?? '(none)'}\n`,
    );
    process.exit(1);
  }

  heading(mode === 'trial' ? 'Trial run (will roll back)' : 'Importing');
  const stats = await importArticles(articles, author.id, categoryIds);
  row('Created', stats.created);
  row('Updated', stats.updated);
  row('Unchanged (hash match)', stats.unchanged);
  row('Internal links rewritten', stats.linksRewritten);

  if (mode === 'trial') {
    console.log(
      `\n${green(bold('Trial complete — rolled back, database unchanged.'))}\n` +
        `To commit:  ${dim(`--mode=execute --confirm=${targetDb}`)}\n`,
    );
    return;
  }

  const live = await prisma.blogPost.count({
    where: { authorKind: AuthorKind.EDITORIAL, isPublished: true, publishedAt: { lte: new Date() } },
  });
  heading('Verification');
  row('Editorial posts live', live);
  console.log(`\n${green(bold('Import complete.'))}\n`);
}

main()
  .catch((e) => {
    console.error(red('\nImport failed:'), e);
    console.error('\nThe transaction rolled back; the database is unchanged.\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
