import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchStaticPage } from '@/lib/staticPages';
import { StaticPageRenderer } from '@/components/public/static/StaticPageRenderer';

// Slug stays "travel-disclosures" (matches the existing DB row + seed
// migration). Only the URL changes — `/disclosures` per the compliance
// implementation spec — with `/travel-disclosures` 301 → `/disclosures`
// handled in next.config.ts so any stale inbound links still resolve.
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

export default async function DisclosuresPage() {
  const page = await fetchStaticPage(SLUG);
  if (!page) notFound();

  return (
    <StaticPageRenderer
      page={page}
      crossLink={{ href: '/refund-policy', label: 'Cancellation & Refund Policy' }}
    />
  );
}
