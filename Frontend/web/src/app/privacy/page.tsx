import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

const SLUG = 'privacy';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG);
  return {
    title: page?.metaTitle ?? 'Privacy Policy | Spiritual California',
    description:
      page?.metaDescription ??
      'Privacy Policy for the Spiritual California marketplace platform.',
  };
}

/**
 * `/privacy` renders the CMS-authored static page with slug="privacy".
 * Admin edits in `/static-pages` propagate here within the ISR window
 * (see `fetchStaticPage` — currently 5 minutes).
 */
export default async function PrivacyPage() {
  const page = await fetchStaticPage(SLUG);
  if (!page) notFound();

  return (
    <StaticPageRenderer
      page={page}
      crossLink={{ href: '/terms', label: 'Terms of Service' }}
    />
  );
}
