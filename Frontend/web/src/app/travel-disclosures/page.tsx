import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

const SLUG = 'travel-disclosures';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG);
  return {
    title: page?.metaTitle ?? 'Travel Disclosures | Spiritual California',
    description:
      page?.metaDescription ??
      'California Seller of Travel disclosures required under California Business & Professions Code §17550.13 and §17550.20.',
  };
}

/**
 * `/travel-disclosures` renders the CMS-authored static page with
 * slug="travel-disclosures". Seeded by migration
 * 20260525130000_seed_travel_disclosures; admin edits in /admin/static-pages
 * propagate here within the ISR window (see fetchStaticPage — currently 5
 * minutes).
 */
export default async function TravelDisclosuresPage() {
  const page = await fetchStaticPage(SLUG);
  if (!page) notFound();

  return (
    <StaticPageRenderer
      page={page}
      crossLink={{ href: '/refund-policy', label: 'Cancellation & Refund Policy' }}
    />
  );
}
