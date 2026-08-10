import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

const SLUG = 'crisis-support';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG);
  return {
    title: page?.metaTitle ?? 'Crisis Support | Spiritual California',
    description:
      page?.metaDescription ??
      'Free, confidential crisis lines available 24/7 in the United States.',
  };
}

/**
 * `/crisis-support` renders the CMS-authored page with slug="crisis-support".
 *
 * Linked from every article footer. 24 articles across the library instruct
 * readers to "contact a crisis line" without giving a number — this is the page
 * that makes those instructions actionable, which is why the client treated it
 * as a hard blocker for the What To Do series.
 *
 * Deliberately carries no `crossLink`: every other static page cross-promotes a
 * sibling, but someone arriving here should be given phone numbers and nothing
 * else to click.
 */
export default async function CrisisSupportPage() {
  const page = await fetchStaticPage(SLUG);
  if (!page) notFound();

  return <StaticPageRenderer page={page} />;
}
