import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

const SLUG = 'mission';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG);
  return {
    title: page?.metaTitle ?? 'Our Mission | Spiritual California',
    description:
      page?.metaDescription ??
      "Spiritual California's mission: building a single trusted destination for mind, body and soul — where verification, community, and transformation converge.",
  };
}

/**
 * `/mission` renders the CMS-authored static page with slug="mission"
 * inside the public marketing frame (full Navbar + Footer). Admin edits
 * via `/static-pages` propagate here within the ISR window (5 minutes).
 */
export default async function MissionPage() {
  const page = await fetchStaticPage(SLUG);
  if (!page) notFound();

  return <StaticPageRenderer page={page} layout="marketing" />;
}
