import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

const SLUG = 'about';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPage(SLUG);
  return {
    title: page?.metaTitle ?? 'About Us | Spiritual California',
    description:
      page?.metaDescription ??
      'Learn how Spiritual California is building a trusted, verified marketplace connecting seekers with authentic wellness practitioners.',
  };
}

/**
 * `/about` renders the CMS-authored static page with slug="about" inside
 * the public marketing frame (full Navbar + Footer). Admin edits via
 * `/static-pages` propagate here within the ISR window (5 minutes).
 */
export default async function AboutPage() {
  const page = await fetchStaticPage(SLUG);
  if (!page) notFound();

  return <StaticPageRenderer page={page} layout="marketing" />;
}
