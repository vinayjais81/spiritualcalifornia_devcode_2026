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

// Fallback static data
const staticPractitioners = [
  { name: 'Maya Rosenberg', specialty: 'Meditation · Energy Healing', image: '/images/hero2.jpg', verified: true, href: '/practitioners' },
  { name: 'Priya Nair', specialty: 'Ayurveda · Life Coaching', image: '/images/hero3.jpg', verified: true, href: '/practitioners' },
  { name: 'Serena Walsh', specialty: 'Reiki · Sound Healing', image: '/images/hero1.jpg', verified: false, href: '/practitioners' },
  { name: 'Lena Kovacs', specialty: 'Yoga · Breathwork', image: '/images/yoga_outdoor.jpg', verified: true, href: '/practitioners' },
  { name: 'Ananda Silva', specialty: 'TCM · Herbalism', image: '/images/hero2.jpg', verified: false, href: '/practitioners' },
  { name: 'Luna Park', specialty: 'Tibetan Medicine · QiGong', image: '/images/hero3.jpg', verified: true, href: '/practitioners' },
];

const staticFeedCards = [
  { image: '/images/hero1.jpg', imageAlt: 'Post', tag: 'Mind Healing', tagVariant: 'default' as const, title: 'How to Break the Cycle of Burnout Through Somatic Awareness', excerpt: 'When the body holds what the mind cannot process, healing begins not in thought but in sensation...', avatarImage: '/images/hero2.jpg', avatarAlt: 'Author', metaText: 'Spiritual CA · 5 min read' },
  { image: '/images/ayurveda.jpg', imageAlt: 'Post', tag: 'Body Healing', tagVariant: 'default' as const, title: 'Ayurvedic Morning Rituals to Restore Your Dosha Balance', excerpt: 'Ancient wisdom meets modern life: five practices you can begin tomorrow to recalibrate your energy...', avatarImage: '/images/hero3.jpg', avatarAlt: 'Author', metaText: 'Spiritual CA · 7 min read' },
];

function estimateReadTime(excerpt: string | null): string {
  const words = (excerpt || '').split(/\s+/).length;
  return `${Math.max(3, Math.ceil(words / 40))} min read`;
}

interface Props {
  guides?: Guide[] | null;
  blogPosts?: BlogPost[] | null;
}

export function PractitionersSection({ guides, blogPosts }: Props) {
  const practitionerCards = guides && guides.length > 0
    ? guides.map(g => ({
        name: g.displayName,
        specialty: g.specialties.join(' · ') || g.tagline || '',
        image: g.avatarUrl || '/images/hero1.jpg',
        verified: g.isVerified,
        href: `/guides/${g.slug}`,
      }))
    : staticPractitioners;

  const feedCardData = blogPosts && blogPosts.length > 0
    ? blogPosts.map(p => ({
        image: p.coverImageUrl || '/images/hero1.jpg',
        imageAlt: p.title,
        tag: p.tags[0] || 'Wellness',
        tagVariant: 'default' as const,
        title: p.title,
        excerpt: p.excerpt || '',
        avatarImage: p.guide.avatarUrl || '/images/logo.jpg',
        avatarAlt: p.guide.displayName,
        metaText: `${p.guide.displayName} · ${estimateReadTime(p.excerpt)}`,
      }))
    : staticFeedCards;

  return (
    <section id="practitioners" style={{ padding: '60px 0 72px' }}>
      <SectionHeader title="Practitioners" linkLabel="View All" linkHref="/practitioners" />

      {/* Practitioners strip */}
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

      {/* Feed cards carousel */}
      <Carousel id="practitioners-feed">
        {feedCardData.map(card => (
          <div key={card.title} data-card>
            <FeedCard {...card} />
          </div>
        ))}
      </Carousel>
    </section>
  );
}
