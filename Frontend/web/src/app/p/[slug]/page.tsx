import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Dynamic catch-all under `/p/*` for admin-authored CMS pages that don't have
 * a dedicated top-level route. Canonical pages like `/privacy` and `/terms`
 * keep their own files; new pages created via the admin CMS panel appear at
 * `/p/<slug>` without requiring a code change.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchStaticPage(slug);
  if (!page) return { title: 'Not Found' };
  return {
    title: page.metaTitle ?? `${page.title} | Spiritual California`,
    description: page.metaDescription ?? undefined,
  };
}

export default async function DynamicStaticPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchStaticPage(slug);
  if (!page) notFound();

  return <StaticPageRenderer page={page} />;
}
