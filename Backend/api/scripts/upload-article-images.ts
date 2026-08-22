/**
 * Push the article hero images to S3.
 *
 * Serving 124 WebP files (~19 MB) out of the Next.js `public/` folder means
 * every deploy ships them again and the repo carries them forever. They are
 * immutable content addressed by a stable slug — exactly what object storage
 * plus a CDN is for.
 *
 * Keys mirror the source layout so the mapping stays obvious:
 *
 *   Frontend/web/public/images/journal/reiki-two-reviews.webp
 *   →  s3://<bucket>/article-images/journal/reiki-two-reviews.webp
 *
 * Two modes:
 *   --mode=report    Lists what would upload, what already exists, and the
 *                    resolved public base URL. Touches nothing. Default.
 *   --mode=execute   Uploads. Skips objects already present unless --force.
 *
 * Usage:
 *   npm run images:report
 *   npm run images:execute
 *
 * Flags:
 *   --source=<dir>   Root holding journal/ what-to-do/ clinic/ subfolders.
 *                    Defaults to Frontend/web/public/images.
 *   --force          Re-upload even when the object already exists.
 *
 * Reuses AWS_S3_BUCKET / AWS_REGION / AWS_CLOUDFRONT_URL — the same variables
 * UploadService reads, and already declared in config/env.validation.ts.
 * A new variable would be silently ignored until added there (Zod strips
 * unknown keys), so deliberately none is introduced.
 */

import 'dotenv/config';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { hasExplicitAwsKeys } from '../src/common/aws-config';

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const has = (n: string) => args.includes(`--${n}`);

const mode = flag('mode') === 'execute' ? 'execute' : 'report';
const force = has('force');
const sourceRoot =
  flag('source') ?? join(__dirname, '..', '..', '..', 'Frontend', 'web', 'public', 'images');

/** Matches the frontmatter folders; the S3 key keeps the same shape. */
const SERIES_DIRS = ['journal', 'what-to-do', 'clinic'];
const KEY_PREFIX = 'article-images';

const bucket = process.env.AWS_S3_BUCKET ?? '';
const region = process.env.AWS_REGION ?? 'us-west-1';
const cloudfrontUrl = process.env.AWS_CLOUDFRONT_URL ?? '';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const heading = (t: string) => console.log(`\n${bold(t)}\n${dim('─'.repeat(t.length))}`);
const row = (l: string, v: string | number) => console.log(`  ${l.padEnd(30, '.')} ${v}`);

/** Same precedence UploadService.getFileUrl uses, so URLs stay consistent. */
function publicBase(): string {
  return cloudfrontUrl || `https://${bucket}.s3.${region}.amazonaws.com`;
}

interface Item {
  key: string;
  absPath: string;
  bytes: number;
}

function collect(): Item[] {
  const items: Item[] = [];
  for (const dir of SERIES_DIRS) {
    const abs = join(sourceRoot, dir);
    if (!existsSync(abs)) {
      console.error(red(`source folder missing: ${abs}`));
      process.exit(1);
    }
    for (const file of readdirSync(abs).filter((f) => f.endsWith('.webp')).sort()) {
      const absPath = join(abs, file);
      items.push({
        key: `${KEY_PREFIX}/${dir}/${file}`,
        absPath,
        bytes: readFileSync(absPath).byteLength,
      });
    }
  }
  return items;
}

async function main() {
  /**
   * Configured-ness is decided by the BUCKET, not by an access key.
   *
   * Production authenticates through the EC2 instance role and deliberately
   * carries no AWS_ACCESS_KEY_ID — so the old check ("no key means not
   * configured") refused to run in exactly the environment it was needed in.
   * The same mistaken test previously put UploadService into stub mode,
   * where uploads reported success and wrote nothing.
   *
   * The bucket is the honest signal: no bucket means nowhere to upload,
   * regardless of how credentials arrive.
   */
  if (!bucket || bucket.startsWith('your-') || bucket.toUpperCase().startsWith('PLACEHOLDER')) {
    console.error(
      red('\nREFUSED: S3 is not configured.') +
        '\nAWS_S3_BUCKET must name a real bucket.\n' +
        'Credentials come from the environment or, in production, the instance role.\n',
    );
    process.exit(1);
  }

  const items = collect();
  const totalBytes = items.reduce((n, i) => n + i.bytes, 0);

  heading('Target');
  row('Bucket', bucket);
  row('Region', region);
  row('Public base', publicBase());
  row('Key prefix', `${KEY_PREFIX}/`);
  row('Source', sourceRoot);
  row('Mode', mode);

  heading('Files');
  for (const dir of SERIES_DIRS) {
    row(dir, items.filter((i) => i.key.startsWith(`${KEY_PREFIX}/${dir}/`)).length);
  }
  row('TOTAL', `${items.length} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);

  console.log(`\n  ${dim('Example:')} ${publicBase()}/${items[0]?.key ?? ''}`);

  // Omits `credentials` entirely when no explicit keys are set, so the SDK
  // resolves the instance profile. Passing empty strings does NOT fall back —
  // it fails with a signature error that reads like a permissions problem.
  const s3 = new S3Client(
    hasExplicitAwsKeys(accessKeyId, secretAccessKey)
      ? { region, credentials: { accessKeyId, secretAccessKey } }
      : { region },
  );

  if (mode === 'report') {
    // Sample rather than HEAD all 124 — enough to say whether a previous run
    // already populated the prefix.
    let present = 0;
    for (const item of items.slice(0, 10)) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: item.key }));
        present++;
      } catch {
        /* absent */
      }
    }
    heading('Existing objects (sample of 10)');
    row('Already in S3', present);
    console.log(
      `\n${bold('Report only — nothing was uploaded.')}\n` +
        `Next: ${dim('--mode=execute')}\n`,
    );
    return;
  }

  heading('Uploading');
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    if (!force) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: item.key }));
        skipped++;
        continue;
      } catch {
        /* not present — upload it */
      }
    }

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: item.key,
          Body: readFileSync(item.absPath),
          ContentType: 'image/webp',
          // Slugs are permanent and an article's hero never changes in place,
          // so these can be cached indefinitely. A replacement would ship under
          // a new slug.
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      uploaded++;
      if (uploaded % 25 === 0) console.log(dim(`  … ${uploaded} uploaded`));
    } catch (e: any) {
      failed++;
      console.log(`  ${red('FAILED')} ${item.key}: ${e.message}`);
    }
  }

  heading('Result');
  row('Uploaded', uploaded);
  row('Skipped (already present)', skipped);
  row('Failed', failed ? red(String(failed)) : '0');

  if (failed) {
    console.log(red('\nSome uploads failed — do not remove the local copies yet.\n'));
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n${green(bold('Upload complete.'))}\n\n` +
      `Now point the articles at S3:\n` +
      `  ${dim('npm run articles:execute -- --confirm=<db> --force')}\n\n` +
      `${yellow('--force is required')} — the importer skips articles whose contentHash is\n` +
      `unchanged, and moving the images changes no source file.\n`,
  );
}

main().catch((e) => {
  console.error(red('\nUpload failed:'), e);
  process.exitCode = 1;
});
