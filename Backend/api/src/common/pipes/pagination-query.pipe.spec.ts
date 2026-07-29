import { ArgumentMetadata } from '@nestjs/common';
import { PaginationQueryPipe, MAX_PAGE_SIZE } from './pagination-query.pipe';

// Regression cover for DEFECT-004 / NEG-API-007: `?page=-1` produced a
// negative Prisma `skip` and surfaced as an unhandled 500 on every public
// paginated list. See docs/pagination-hardening.md.

const query = (data: string): ArgumentMetadata => ({
  type: 'query',
  data,
  metatype: String,
});

describe('PaginationQueryPipe', () => {
  const pipe = new PaginationQueryPipe();
  const page = (v: unknown) => pipe.transform(v, query('page'));
  const limit = (v: unknown) => pipe.transform(v, query('limit'));

  describe('page', () => {
    it('clamps negatives to 0 so skip can never go negative', () => {
      expect(page('-1')).toBe(0);
      expect(page('-999')).toBe(0);
    });

    // 0 rather than 1: listing endpoints resolve it via `Number(page) || 1`
    // and search via `Number(page) || 0`, so each lands on its own first page.
    it('passes 0 through for both 1-based and 0-based callers', () => {
      expect(page('0')).toBe(0);
    });

    it('preserves valid pages', () => {
      expect(page('1')).toBe(1);
      expect(page('7')).toBe(7);
    });

    it('truncates fractional pages', () => {
      expect(page('2.9')).toBe(2);
    });

    it('falls back to undefined for non-numeric input so the caller default applies', () => {
      expect(page('abc')).toBeUndefined();
      expect(page('')).toBeUndefined();
      expect(page(undefined)).toBeUndefined();
      expect(page(null)).toBeUndefined();
      expect(page('1e999')).toBeUndefined(); // Infinity
      expect(page(['1', '2'])).toBeUndefined(); // ?page=1&page=2
    });
  });

  describe('limit', () => {
    it('caps at MAX_PAGE_SIZE to stop unbounded public scans', () => {
      expect(limit('999999')).toBe(MAX_PAGE_SIZE);
    });

    it('collapses non-positive values to 0 so the caller default applies', () => {
      expect(limit('-5')).toBe(0);
      expect(limit('0')).toBe(0);
    });

    it('preserves valid limits, including the largest the web client requests', () => {
      expect(limit('20')).toBe(20);
      expect(limit('200')).toBe(200);
    });

    it('falls back to undefined for non-numeric input', () => {
      expect(limit('abc')).toBeUndefined();
      expect(limit(undefined)).toBeUndefined();
    });
  });

  describe('scope', () => {
    it('ignores other query params', () => {
      expect(pipe.transform('CRYSTALS', query('category'))).toBe('CRYSTALS');
      expect(pipe.transform('-1', query('offset'))).toBe('-1');
    });

    it('ignores body and route params named page/limit', () => {
      expect(
        pipe.transform('-1', { type: 'body', data: 'page', metatype: String }),
      ).toBe('-1');
      expect(
        pipe.transform('-1', { type: 'param', data: 'page', metatype: String }),
      ).toBe('-1');
    });
  });

  // The actual defect: these are the values the controllers compute after the
  // pipe has run. A negative here is what reached Prisma and 500'd.
  describe('resulting skip is never negative', () => {
    it.each([
      ['-1', 50],
      ['-999', 20],
      ['0', 24],
      ['abc', 12],
    ])('page=%s limit=%i', (raw, perPage) => {
      const resolved = Number(page(raw)) || 1; // the `Number(x) || 1` controller idiom
      expect((resolved - 1) * perPage).toBeGreaterThanOrEqual(0);
    });
  });
});
