# QA Deploy Freeze — an Environment-Asymmetric Migration

QA (`spiritualcalifornia.nityo.in`) deployed nothing for nine days, from
2026-08-23 to 2026-08-31. Runs #257–#263 of **Deploy to QA EC2** all failed in
an identical ~50s while production deployed cleanly from the same commits.

## Symptom

Every push to `main` failed the same way regardless of what it touched —
backend fixes, infra scripts, even a docs-only commit. Meanwhile the QA *site*
stayed up and looked healthy, and `git log` on the box reported the newest
commit. Nothing pointed at a deploy problem unless you opened the run.

## Cause

`20260823060000_sync_drifted_schema` was written to repair **production's**
schema. Its header records why the two environments differ:

> these fields were added to schema.prisma and pushed to QA with
> `prisma db push`, which alters the database WITHOUT recording a migration.
> QA therefore has the columns and works; production, built purely from the
> migration history, does not.

The migration is plain additive DDL — `CREATE TYPE "TourTrack"`,
`ADD COLUMN "isFeatured"`, `ADD COLUMN "trackType"` — with no `IF NOT EXISTS`.
On production those objects were missing, so it applied and fixed the homepage
500. On QA they already existed, so the first statement failed with
`type "TourTrack" already exists`.

`npx prisma migrate deploy` sits under `set -e` in `.github/workflows/deploy.yml`,
so the script aborted there. Prisma then recorded the migration as *failed*, and
every later run died immediately on `P3009` — which is why unrelated commits
failed too, and why every run took the same ~50s.

**One migration cannot serve two environments whose schemas diverged.** The
divergence, not the migration, is the defect.

## Why it hid so well

Two false signals kept this invisible for nine days:

- **The site stayed up.** The deploy dies before `pm2 restart`, so the previous
  build keeps serving. A working QA site is not evidence of a working deploy.
- **`git log` on the box showed the newest commit.** `git fetch` and
  `git reset --hard` run *before* the failing step, so the source tree advances
  while `dist/` and `.next` stay stale. The box reported `5213b97` while running
  Aug 23 code. Verify a deploy by build artefacts and PM2 uptime, never by
  `git log`.

## Diagnosis

```bash
ssh -i <key>.pem ubuntu@50.18.68.20
cd /var/www/spiritual-california/Backend/api
npx prisma migrate status     # names the failed migration
```

Before resolving, confirm QA genuinely has every object the migration creates —
`db push` divergence is ad-hoc, so it may have some and not others. Marking a
migration applied when the schema is missing pieces trades a broken deploy for
broken runtime queries.

```sql
SELECT
 (SELECT count(*) FROM pg_type WHERE typname='TourTrack'),
 (SELECT count(*) FROM pg_type WHERE typname='ProductCategory'),
 (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
    WHERE t.typname='EventType' AND e.enumlabel='RETREAT'),
 (SELECT count(*) FROM information_schema.columns
    WHERE table_name='guide_profiles' AND column_name='isFeatured'),
 (SELECT count(*) FROM information_schema.columns
    WHERE table_name='order_items' AND column_name='downloadUrlExpiresAt'),
 (SELECT count(*) FROM information_schema.columns
    WHERE table_name='products' AND column_name='category'),
 (SELECT count(*) FROM information_schema.columns
    WHERE table_name='soul_tours'
      AND column_name IN ('latestUpdate','latestUpdateAt','trackType'));
```

All seven came back present, so QA needed no manual DDL. (Prisma wraps a
migration in a transaction, so the failure rolled back whole — nothing was
half-applied.)

Note `psql` rejects Prisma's `?schema=public` suffix; strip the query string
from `DATABASE_URL` first.

## Resolution

```bash
npx prisma migrate resolve --rolled-back "20260823060000_sync_drifted_schema"
npx prisma migrate resolve --applied     "20260823060000_sync_drifted_schema"
npx prisma migrate status     # Database schema is up to date!
```

`--rolled-back` first: Prisma refuses `--applied` on a migration still recorded
as failed. Neither command touches the schema; they only correct the bookkeeping
in `_prisma_migrations`.

Then re-run the workflow. Run #264 took 2m 52s and shipped six commits' worth of
built output at once.

Do **not** edit the migration file to add `IF NOT EXISTS`. Production already
applied it, and Prisma checksums migration files — an edit would break the
production pipeline instead.

## Verifying a QA deploy

`git log` on the box proves nothing. Check:

```bash
ls -l Backend/api/dist/main.js Frontend/web/.next/BUILD_ID   # timestamps moved
pm2 list                                                      # uptime reset
```

and confirm the change is in what's actually served — for a frontend change,
find the page's chunk under `/_next/static/chunks/` and grep it for a string the
change introduced.

## Prevention

1. **Never `prisma db push` against QA.** It mutates the database without
   recording a migration, which is the sole root cause here. Schema changes go
   through `prisma migrate dev` and get committed, so every environment replays
   one history. This is the actual fix; the rest is damage control.
2. **Give the QA workflow a post-restart health check.** Production verifies the
   real site after deploying; QA has no equivalent, which is why a dead pipeline
   looked healthy for nine days. A `curl -fsS <qa>/api/v1/health` after
   `pm2 restart` would have caught this on day one.
3. **Consider `paths-ignore` for `infra/**` and `docs/**`.** Roughly half the
   runs in this window were prod-only changes that cannot affect the QA box;
   the noise made a real failure easy to miss.
