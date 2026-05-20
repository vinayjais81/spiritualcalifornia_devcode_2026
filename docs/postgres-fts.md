# Postgres Full-Text Search

**Status:** Shipped 2026-05-20
**Migration:** `20260520120000_postgres_fts`
**Replaces:** Algolia (kept in code, dormant via `ALGOLIA_ENABLED=false`)

## Why

Algolia worked but was being paid for and nobody on the frontend was actually
querying it. The reindex pipeline ran on every mutation, the indices held
fresh data, and the `/search/*` API endpoints returned valid Algolia results
— but no UI consumed them. The decision was to:

1. Keep the Algolia integration code in the tree (gated behind an env flag) so
   we can revert if Postgres FTS proves insufficient at scale.
2. Switch the actual search backend to Postgres full-text search.

The current marketplace is comfortably small enough that Postgres FTS gives
sub-50ms response times against indexed `tsvector` columns. The trade-off is
losing Algolia's out-of-the-box typo tolerance and faceted-search niceties —
acceptable for now, can be added later via `pg_trgm` and structured filter
params when/if needed.

## Coverage

Five entities have a `searchVector tsvector` column + GIN index:

| Entity | Searched fields (weighted A > B > C) | Public-visibility gate (mirrors listings) |
|---|---|---|
| `GuideProfile` | A: `displayName`, `modalities[]` · B: `tagline`, `location`, `issuesHelped[]` · C: `bio`, `languages[]` | `isPublished AND isVerified AND user.isActive` |
| `Product` | A: `name` · B: `description` · C: `category` (underscores → spaces) | `isActive AND guide.user.isActive` |
| `Event` | A: `title` · B: `description` · C: `location` | `isPublished AND NOT isCancelled AND guide.user.isActive` |
| `SoulTour` | A: `title` · B: `shortDesc`, `location` · C: `description`, `country` | `isPublished AND NOT isCancelled AND guide.user.isActive` |
| `BlogPost` | A: `title` · B: `excerpt`, `tags[]` · C: `content` | `isPublished AND guide.user.isActive` |

The weights bias ranking toward title/name matches over body matches — same
idea as Algolia's per-attribute priority.

## How the `searchVector` stays current

A `BEFORE INSERT OR UPDATE` trigger per table rebuilds `searchVector` from
the row's text fields whenever they change. No app-side denormalization, no
reindex job.

Generated columns (Postgres 12+) would have been cleaner, but
`to_tsvector('english', text)` is marked `STABLE` not `IMMUTABLE` and that
propagates through `IMMUTABLE` SQL wrappers when Postgres verifies generated
column expressions. Triggers don't need immutability so they sidestep the
issue entirely.

Backfill statements in the migration (`UPDATE table SET title = title;`)
touch every existing row so the trigger fires once and populates the column.

## Querying

Frontend hits the same `/search/*` API endpoints that previously served
Algolia. Response shapes are similar enough that any future frontend search
UI doesn't care about the backend swap.

Endpoints:

- `GET /search?q=…` — cross-entity top-5 from each (returns `{ guides, products, events, tours, blog }`)
- `GET /search/guides?q=…&page=…`
- `GET /search/products?q=…&page=…`
- `GET /search/events?q=…&page=…`
- `GET /search/tours?q=…&page=…` *(new — Algolia path didn't have this)*
- `GET /search/blog?q=…&page=…` *(new)*

Each entity endpoint returns `{ hits, nbHits, page, hitsPerPage }`.

Query parsing uses `websearch_to_tsquery('english', q)` so users can type:
- plain words: `sound healing` (implicit AND)
- exact phrases: `"sound healing"`
- exclusion: `meditation -reiki`
- alternation: `yoga OR pilates`

Ranking uses `ts_rank_cd` on the indexed `searchVector`. Empty/whitespace
queries return `{ hits: [], nbHits: 0 }` without touching the DB.

## Algolia revert path

Code stays in the tree:
- `algolia.service.ts` — every SDK call early-returns when `ALGOLIA_ENABLED !== 'true'`.
- `SearchService.searchAll` / `searchGuides` / etc. currently delegate to
  `PostgresSearchService`. Swap the delegation back to `this.algolia.searchX`
  to re-enable.
- `reindex*`, `indexGuide`, `removeGuide` etc. are intact — they no-op when
  disabled, so cascade calls from `admin.service.deactivate` and the like
  don't need conditional logic.

To revert:
1. `ALGOLIA_ENABLED=true` + populate `ALGOLIA_APP_ID` / `ALGOLIA_ADMIN_API_KEY`.
2. Run `POST /search/reindex` to repopulate Algolia indices from Postgres.
3. Change `SearchService` methods to call `this.algolia.searchX(...)` instead
   of `this.pg.searchX(...)`.

No schema migration needed to revert. The `searchVector` columns are
harmless when Algolia is in use — they update on every write and cost
some storage, no query overhead.

## Typo tolerance via pg_trgm

Added 2026-05-20 in migration `20260520150000_postgres_fts_trgm`. The
five search methods now combine three matching signals:

| Signal | Strength | Where used |
|---|---|---|
| `websearch_to_tsquery` vs `searchVector` | exact tokens, stemming-aware | all entities |
| `similarity(short_field, q)` | full-string trigram match | guide `displayName`, product `name`, event `title`, tour `title`, blog `title` |
| `word_similarity(q, long_field)` | best-substring trigram match | guide `tagline`, tour `shortDesc` |

The three are OR'd in WHERE, GREATEST'd in ORDER BY. A row matching any
signal surfaces; the strongest signal drives its rank.

Thresholds (set once in `postgres-search.service.ts`):
- `SIMILARITY_THRESHOLD = 0.25` — full-string trigram match (default 0.3)
- `WORD_SIMILARITY_THRESHOLD = 0.5` — substring trigram match (default 0.6)

Verified: "soun heling" (two typos) still finds Michael Tanaka's
"Sound Healing Practitioner & Tibetan Bowl Specialist" tagline.

Index-wise, the migration adds GIN trigram indices on the short fields
(`gin_trgm_ops`), so `%` and `<%` operator queries stay fast. Long-body
fields (`bio`, `description`, `content`) are FTS-only — trigrams on
them would bloat the index and surface noisy matches.

## Known limitations vs Algolia

- **No faceted-search filters yet.** Algolia's `filters` query param is
  ignored. When/if facet filtering is needed (e.g. by modality, location,
  price band), add structured filter params to the endpoint signatures.
- **No frontend instant-search SDK.** Queries go through your API instead of
  to Algolia's edge. Adds 50-150ms vs direct edge. Immaterial at current scale.
- **`ts_headline` snippets** (highlighted matched fragments) aren't returned
  by default. Add `ts_headline(...)` to the SELECT when a search UI wants them.

## Files

- `Backend/api/prisma/migrations/20260520120000_postgres_fts/migration.sql` — column + trigger + backfill + GIN index per entity
- `Backend/api/prisma/schema.prisma` — `searchVector Unsupported("tsvector")?` on five models
- `Backend/api/src/modules/search/postgres-search.service.ts` — the 5 search methods + `searchAll`
- `Backend/api/src/modules/search/search.service.ts` — delegates to `PostgresSearchService`
- `Backend/api/src/modules/search/search.controller.ts` — new `/search/tours` + `/search/blog` routes
- `Backend/api/src/modules/search/algolia.service.ts` — every SDK call gated on `this.client !== null`
- `Backend/api/src/config/env.validation.ts` — `ALGOLIA_ENABLED` registered
- `Backend/api/.env.example` — flag documented
