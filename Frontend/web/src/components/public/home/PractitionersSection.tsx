import { SectionHeader } from '@/components/public/shared/SectionHeader';
import { PractitionerCard } from '@/components/public/shared/PractitionerCard';
import { FeedCard } from '@/components/public/shared/FeedCard';
import { Carousel } from '@/components/public/shared/Carousel';

interface Guide {
  slug: string;
  displayName: string;
  tagline: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  specialties: string[];
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string;
  guide: { slug: string; displayName: string; avatarUrl: string | null };
}

function estimateReadTime(excerpt: string | null): string {
  const words = (excerpt || '').split(/\s+/).length;
  return `${Math.max(3, Math.ceil(words / 40))} min read`;
}

interface Props {
  guides?: Guide[] | null;
  blogPosts?: BlogPost[] | null;
}

export function PractitionersSection({ guides, blogPosts }: Props) {
  const hasGuides = !!guides && guides.length > 0;
  const hasBlogPosts = !!blogPosts && blogPosts.length > 0;

  // If both sub-sections would be empty, skip the whole section — placeholder
  // guides/posts would be misleading on the homepage.
  if (!hasGuides && !hasBlogPosts) return null;

  const practitionerCards = hasGuides
    ? guides!.map(g => ({
        name: g.displayName,
        specialty: g.specialties.join(' · ') || g.tagline || '',
        image: g.avatarUrl || '/images/hero1.jpg',
        verified: g.isVerified,
        href: `/guides/${g.slug}`,
      }))
    : [];

  const feedCardData = hasBlogPosts
    ? blogPosts!.map(p => ({
        image: p.coverImageUrl || '/images/hero1.jpg',
        imageAlt: p.title,
        tag: p.tags[0] || 'Wellness',
        tagVariant: 'default' as const,
        title: p.title,
        excerpt: p.excerpt || '',
        avatarImage: p.guide.avatarUrl || '/images/logo.jpg',
        avatarAlt: p.guide.displayName,
        metaText: `${p.guide.displayName} · ${estimateReadTime(p.excerpt)}`,
        href: `/journal/${p.guide.slug}/${p.slug}`,
      }))
    : [];

  return (
    <section id="practitioners" style={{ padding: '60px 0 72px' }}>
      <SectionHeader title="Practitioners" linkLabel="View All" linkHref="/practitioners" />

      {hasGuides && (
        <div style={{ marginBottom: '48px' }}>
          <Carousel id="practitioners-strip">
            {practitionerCards.map(p => (
              <div key={p.name} data-card>
                <PractitionerCard
                  image={p.image}
                  name={p.name}
                  specialty={p.specialty}
                  verified={p.verified}
                  href={p.href}
                />
              </div>
            ))}
          </Carousel>
        </div>
      )}

      {hasBlogPosts && (
        <Carousel id="practitioners-feed">
          {feedCardData.map(card => (
            <div key={card.title} data-card>
              <FeedCard {...card} />
            </div>
          ))}
        </Carousel>
      )}
    </section>
  );
}
