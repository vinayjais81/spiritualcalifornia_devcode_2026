import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * On-demand revalidation for CMS-authored static pages.
 *
 * The backend calls this after every create / update / delete on a
 * `StaticPage` so admin edits appear on the public site without waiting for
 * the ISR window to expire (currently 5 minutes, see `fetchStaticPage`).
 *
 * Protected by a shared secret — the backend reads it from
 * `STATIC_PAGE_REVALIDATE_SECRET`; Next.js reads it from the same env var.
 * Requests without a matching `secret` are rejected with 401.
 */

interface Body {
  slug?: string;
  secret?: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const expected = process.env.STATIC_PAGE_REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'STATIC_PAGE_REVALIDATE_SECRET is not configured' },
      { status: 500 },
    );
  }

  if (!body.secret || body.secret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!body.slug || typeof body.slug !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'slug is required' },
      { status: 400 },
    );
  }

  // Tag-based revalidation targets the fetch cache written by
  // `fetchStaticPage(slug)` — one key per slug. Next.js 16 requires a cache
  // profile argument; 'default' expires the tag immediately on next read.
  // Path revalidation covers the dedicated top-level route (/privacy, /terms,
  // /about, /mission) *and* the catch-all /p/<slug> route so both are
  // invalidated regardless of where the page is published.
  revalidateTag(`static-page:${body.slug}`, 'default');
  revalidatePath(`/${body.slug}`);
  revalidatePath(`/p/${body.slug}`);

  return NextResponse.json({ ok: true, slug: body.slug });
}
