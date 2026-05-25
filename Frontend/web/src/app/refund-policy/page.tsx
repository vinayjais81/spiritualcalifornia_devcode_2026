import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

const SLUG = 'refund-policy';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG);
  return {
    title: page?.metaTitle ?? 'Cancellation & Refund Policy | Spiritual California',
    description:
      page?.metaDescription ??
      'Cancellation and refund policy for the Spiritual California marketplace platform.',
  };
}

/**
 * `/refund-policy` renders the CMS-authored static page with slug="refund-policy".
 * Admin edits in `/admin/static-pages` propagate here within the ISR window
 * (see `fetchStaticPage` — currently 5 minutes). Page row must be created
 * via the CMS once before this route can render; until then it 404s.
 */
export default async function RefundPolicyPage() {
  const page = await fetchStaticPage(SLUG);
  if (!page) notFound();

  return (
    <StaticPageRenderer
      page={page}
      crossLink={{ href: '/travel-disclosures', label: 'Travel Disclosures' }}
    />
  );
}
