import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Hard ceiling on any client-supplied `limit`.
 *
 * Public catalog endpoints are unauthenticated, so an unbounded `limit` is a
 * free full-table scan for anyone who asks. 200 is comfortably above the
 * largest value the web client actually requests.
 */
export const MAX_PAGE_SIZE = 200;

/**
 * Normalises the `page` and `limit` query parameters application-wide.
 *
 * ## Why this exists
 *
 * Public list endpoints read pagination straight off named query params
 * (`@Query('page') page?: string`) and coerce with the `Number(x) || default`
 * idiom. That idiom is safe for `0`, `''` and `'abc'` — all falsy or NaN, so
 * the default wins — but **not** for negatives: `Number('-1') || 1` is `-1`,
 * which flows into `skip = (page - 1) * limit` and reaches Prisma as a
 * negative `skip`. Prisma rejects it ("Argument skip: Value can't be
 * negative") and it surfaces as an unhandled 500.
 *
 * That was DEFECT-004 / NEG-API-007: `GET /products/public?page=-1` (and the
 * guides, events and blog equivalents) returned 500 on a trivially malformed
 * public request.
 *
 * ## Why a pipe rather than a DTO
 *
 * Admin endpoints already take validated query DTOs (`PaginationQueryDto` has
 * `@Min(1)`), so they correctly return 400 and were never affected. Only the
 * raw-named-param endpoints were, and giving each of those a bespoke DTO would
 * mean a new class per controller for the sake of two shared fields. One
 * global pipe closes the whole family — including any endpoint added later,
 * which is the part a per-controller fix cannot guarantee.
 *
 * ## Clamping, not rejecting
 *
 * These are public catalog endpoints hit by crawlers and stale links, so we
 * clamp and serve rather than 400. This also keeps every currently-passing
 * case byte-identical: `page=0`, `limit=abc`, `limit=-5` and `limit=0` all
 * still resolve to the endpoint's own default.
 *
 * `page` is clamped to `>= 0` rather than `>= 1` on purpose. Listing endpoints
 * are 1-based (`Number(page) || 1`) and search is 0-based
 * (`Number(page) || 0`); handing both a `0` lets each one's existing `||`
 * fall through to the correct first page. Clamping to 1 would silently serve
 * search's *second* page for a malformed request.
 *
 * Non-numeric input resolves to `undefined` so the controller's own default
 * applies, exactly as `Number('abc') || 20` did before.
 */
@Injectable()
export class PaginationQueryPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Only touch query params, and only the two pagination ones. Body/param
    // values and every other query key pass through untouched.
    if (metadata.type !== 'query') return value;

    if (metadata.data === 'page') {
      const page = toSafeInt(value);
      return page === undefined ? undefined : Math.max(page, 0);
    }

    if (metadata.data === 'limit') {
      const limit = toSafeInt(value);
      return limit === undefined
        ? undefined
        : Math.min(Math.max(limit, 0), MAX_PAGE_SIZE);
    }

    return value;
  }
}

/**
 * Parse a query value to a whole number, or `undefined` when it isn't one.
 *
 * Handles the awkward inputs Express can produce: a missing param, an empty
 * string, `'abc'`, `'1e999'` (Infinity), and repeated keys like
 * `?page=1&page=2`, which arrive as an array and coerce to NaN.
 */
function toSafeInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}
