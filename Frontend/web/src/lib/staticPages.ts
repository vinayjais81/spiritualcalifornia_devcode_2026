/**
 * Server-side fetcher for CMS-authored static pages (Privacy, Terms, etc.).
 *
 * Used by the App Router pages that render legal / marketing copy. Returns
 * `null` when the slug is missing or the API is unreachable, so callers can
 * fall back to their hardcoded defaults without crashing the page.
 *
 * No React imports — safe to import from Server Components.
 */

export interface StaticPageContent {
  id: string;
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  eyebrow: string | null;
  subtitle: string | null;
  body: string; // rich-text HTML
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchStaticPage(
  slug: string,
): Promise<StaticPageContent | null> {
  try {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${apiUrl}/static-pages/${slug}`, {
      // Revalidate every 5 minutes — admin edits propagate within that window
      // without forcing a per-request DB hit from every visitor.
      next: { revalidate: 300, tags: [`static-page:${slug}`] },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
