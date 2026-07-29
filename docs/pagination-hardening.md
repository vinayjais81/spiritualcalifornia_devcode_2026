# Pagination Hardening — DEFECT-004 / NEG-API-007

**Status:** Fixed
**Date:** 2026-07-29
**Severity:** Low (unhandled 500 on public endpoints; no data exposure)
**Found by:** QA suite `NEG-API-007` (`QA/tests/api/negative.spec.ts`)

---

## 1. The defect

`GET /api/v1/products/public?page=-1` returned **500 Internal Server Error**,
unauthenticated. Same on `/guides/public`, `/events/public` and `/blog`.

### Root cause

Public list endpoints read pagination off raw named query params and coerce
with the `Number(x) || default` idiom:

```ts
// products.controller.ts
findPublic(@Query('limit') limit?: string, @Query('page') page?: string) {
  return this.productsService.findPublic(Number(limit) || 50, Number(page) || 1, ...);
}

// products.service.ts
const skip = (page - 1) * limit;
```

That idiom is safe for `0`, `''` and `'abc'` — all falsy or `NaN`, so the
default wins. It is **not** safe for negatives: `Number('-1') || 1` is `-1`,
because `-1` is truthy. So `page = -1` produces `skip = (-1 - 1) * 50 = -100`,
Prisma rejects it (*"Argument skip: Value can't be negative"*), and nothing
catches it — hence the 500.

This exactly matches the reported isolation: `page=0` → 200 (falsy, defaults to
1), and every bad `limit` → 200 (`-5` is a valid Prisma "take from the end",
`abc`/`0` fall through to the default). **Only a negative `page` was affected.**

### Why admin endpoints were never affected

Admin list endpoints take validated query DTOs, and
`admin/dto/query.dto.ts` → `PaginationQueryDto` already carries
`@Type(() => Number) @IsInt() @Min(1)` on `page` and `@Min(1) @Max(100)` on
`limit`. Those correctly return **400**. The defect was confined to the
raw-named-param family — which is precisely the public, unauthenticated set.

---

## 2. The fix

A single global pipe: `src/common/pipes/pagination-query.pipe.ts`, registered
last in the `useGlobalPipes` stack in `main.ts`.

It normalises **only** `page` and `limit`, and **only** when they arrive as
query params. Everything else passes through untouched.

| Input | Before | After |
|---|---|---|
| `page=-1` | **500** | `0` → endpoint default → 200 |
| `page=0` | 200 | 200 (unchanged) |
| `page=3` | 200 | 200 (unchanged) |
| `page=abc` / `''` / absent | 200 | 200 (unchanged) |
| `page=1e999`, `?page=1&page=2` | 500 / 200 | 200 |
| `limit=abc` / `-5` / `0` | 200 (default) | 200 (default, unchanged) |
| `limit=999999` | 200, unbounded scan | 200, capped at 200 |

### Design decisions

**Clamp, don't 400.** These are public catalog endpoints hit by crawlers and
stale links, so we serve rather than reject — the ticket explicitly allowed
either. Clamping also keeps every currently-passing case byte-identical, so no
existing QA assertion flips.

**`page` clamps to `>= 0`, not `>= 1`.** Listing endpoints are 1-based
(`Number(page) || 1`) but **search is 0-based** (`Number(page) || 0`, then
`skip = page * hitsPerPage`). Handing both a `0` lets each one's own `||` fall
through to its correct first page. Clamping to `1` would silently serve
*search's second page* for a malformed request.

**Non-numeric resolves to `undefined`**, so the endpoint's own default applies —
identical to the old `Number('abc') || 20` behaviour.

**`limit` is capped at `MAX_PAGE_SIZE = 200`.** An unbounded `limit` on an
unauthenticated endpoint is a free full-table scan. 200 is comfortably above
the largest value the web client requests (`limit: 200`), so no caller is
affected.

**Why a pipe rather than a shared DTO.** The ticket suggested a shared
DTO/guard. A DTO would need a new class per controller for the sake of two
shared fields (each public controller has different extra params — `type`,
`category`, `tag`, `q`, …). One global pipe closes the whole family *and* every
endpoint added later — which a per-controller fix cannot guarantee.

### Bonus: search was affected too

`/search/{guides,products,events,tours,blog}?page=-1` had the same defect via
`skip = page * hitsPerPage` (0-based, so `-1` → `skip = -20`). Not in the
report — presumably untested — and now covered by the same pipe.

---

## 3. Verification

`src/common/pipes/pagination-query.pipe.spec.ts` — 15 unit tests over the
clamping arithmetic, including `1e999` and repeated `?page=1&page=2` keys.

`src/common/pipes/pagination-query.pipe.http.spec.ts` — 7 HTTP tests through a
real Nest app with the exact global pipe stack from `main.ts`, against fake
controllers that reproduce the real coercion and offset maths. This proves the
part unit tests cannot: **that a global pipe really is applied to raw
`@Query('page')` params**, which is the entire premise of the fix.

The last block deliberately builds a second app **without** the pipe and
asserts the original **500 still reproduces**. Without it the suite could pass
for the wrong reason if the pipe were ever dropped from `main.ts`.

> Not verified against a live server locally — the API requires Redis on :6379,
> which isn't running in this environment (Docker daemon down). The HTTP specs
> cover the same path without needing Postgres or Redis. **Re-run NEG-API-007
> against QA after deploy**; it is marked `test.fail()`, so it should now flip
> to a loud failure, and that expectation needs removing.

---

## 4. Follow-ups

- **Remove the `test.fail()` marker from NEG-API-007** once QA confirms the
  200. It currently keeps CI green on a known defect that no longer exists.
- The `Number(x) || default` idiom is still spread across ~24 service call
  sites. The pipe makes it safe at the HTTP boundary, but a service invoked
  **directly** with a negative page would still produce a negative `skip`. No
  such caller exists today. If pagination ever moves behind an internal API or
  a queue consumer, add the clamp at the service layer too.

---

## 5. Files touched

**Added**
- `Backend/api/src/common/pipes/pagination-query.pipe.ts`
- `Backend/api/src/common/pipes/pagination-query.pipe.spec.ts`
- `Backend/api/src/common/pipes/pagination-query.pipe.http.spec.ts`

**Modified**
- `Backend/api/src/main.ts` — registers `PaginationQueryPipe` in the global stack
