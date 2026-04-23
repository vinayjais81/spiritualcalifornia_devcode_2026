import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

const SLUG = 'terms';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG);
  return {
    title: page?.metaTitle ?? 'Terms of Service | Spiritual California',
    description:
      page?.metaDescription ??
      'Terms of Service for the Spiritual California marketplace platform.',
  };
}

/**
 * `/terms` renders the CMS-authored static page with slug="terms".
 * Admin edits in `/static-pages` propagate here within the ISR window
 * (see `fetchStaticPage` — currently 5 minutes).
 */
export default async function TermsPage() {
  const page = await fetchStaticPage(SLUG);
  if (!page) notFound();

  return (
    <StaticPageRenderer
      page={page}
      crossLink={{ href: '/privacy', label: 'Privacy Policy' }}
    />
  );
}
