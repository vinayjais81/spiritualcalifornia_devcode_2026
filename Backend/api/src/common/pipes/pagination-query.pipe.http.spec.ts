import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PaginationQueryPipe } from './pagination-query.pipe';
import { SanitizePipe } from '../sanitize.pipe';

// HTTP-level cover for DEFECT-004 / NEG-API-007.
//
// The unit spec proves the pipe's arithmetic. This one proves the part that
// arithmetic can't: that a GLOBAL pipe is actually applied to raw named query
// params (`@Query('page')`), which is the whole premise of the fix. It mirrors
// the real controller/service shape — the `Number(x) || default` coercion and
// the `skip = (page - 1) * limit` offset — without needing Postgres or Redis.

@Controller('products')
class FakeProductsController {
  // Same signature and coercion as the real ProductsController.findPublic.
  @Get('public')
  findPublic(@Query('limit') limit?: string, @Query('page') page?: string) {
    const resolvedLimit = Number(limit) || 50;
    const resolvedPage = Number(page) || 1;
    const skip = (resolvedPage - 1) * resolvedLimit;
    // Prisma throws "Argument skip: Value can't be negative" here, which
    // surfaced as an unhandled 500. Reproduce that contract faithfully.
    if (skip < 0)
      throw new Error(`Argument skip: Value can't be negative (${skip})`);
    return { page: resolvedPage, limit: resolvedLimit, skip };
  }
}

// Search is 0-based; included because clamping page to >= 1 instead of >= 0
// would silently serve its second page for a malformed request.
@Controller('search')
class FakeSearchController {
  @Get('guides')
  searchGuides(@Query('page') page?: string) {
    const resolvedPage = Number(page) || 0;
    const skip = resolvedPage * 20;
    if (skip < 0)
      throw new Error(`Argument skip: Value can't be negative (${skip})`);
    return { page: resolvedPage, skip };
  }
}

describe('PaginationQueryPipe (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FakeProductsController, FakeSearchController],
    }).compile();

    app = moduleRef.createNestApplication();
    // Exactly the global pipe stack from main.ts, in the same order.
    app.useGlobalPipes(
      new SanitizePipe(),
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
      new PaginationQueryPipe(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // The defect, verbatim from the report.
  it('GET /products/public?page=-1 returns 200 instead of 500', async () => {
    const res = await request(app.getHttpServer()).get(
      '/products/public?page=-1',
    );
    expect(res.status).toBe(200);
    expect(res.body.skip).toBe(0);
    expect(res.body.page).toBe(1);
  });

  it('never yields a negative skip for any malformed page', async () => {
    for (const raw of ['-1', '-999', '-0.5', 'abc', '', '0']) {
      const res = await request(app.getHttpServer()).get(
        `/products/public?page=${encodeURIComponent(raw)}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.skip).toBeGreaterThanOrEqual(0);
    }
  });

  it('leaves valid pagination untouched', async () => {
    const res = await request(app.getHttpServer()).get(
      '/products/public?page=3&limit=20',
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 3, limit: 20, skip: 40 });
  });

  it('preserves the previously-passing bad-limit cases as 200 + default', async () => {
    for (const raw of ['abc', '-5', '0']) {
      const res = await request(app.getHttpServer()).get(
        `/products/public?limit=${raw}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(50); // the endpoint's own default
    }
  });

  it('caps an absurd limit rather than allowing an unbounded scan', async () => {
    const res = await request(app.getHttpServer()).get(
      '/products/public?limit=999999',
    );
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(200);
  });

  it('keeps 0-based search on its first page for a negative page', async () => {
    const res = await request(app.getHttpServer()).get(
      '/search/guides?page=-1',
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 0, skip: 0 });
  });
});

// Causation check. Without this, the suite above would still pass if the pipe
// were silently dropped from main.ts and the controllers happened to be safe
// for another reason — so pin the original defect to the pipe's absence.
describe('PaginationQueryPipe (HTTP) — without the pipe, the defect returns', () => {
  let unpatched: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FakeProductsController],
    }).compile();
    unpatched = moduleRef.createNestApplication();
    unpatched.useGlobalPipes(new SanitizePipe()); // deliberately no PaginationQueryPipe
    await unpatched.init();
  });

  afterAll(async () => {
    await unpatched.close();
  });

  it('reproduces the original 500 on ?page=-1', async () => {
    const res = await request(unpatched.getHttpServer()).get(
      '/products/public?page=-1',
    );
    expect(res.status).toBe(500);
  });
});
