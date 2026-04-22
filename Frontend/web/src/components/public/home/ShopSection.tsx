import { SectionHeader } from '@/components/public/shared/SectionHeader';
import { FeedCard } from '@/components/public/shared/FeedCard';
import { Carousel } from '@/components/public/shared/Carousel';

interface Product {
  id: string;
  name: string;
  description: string | null;
  type: 'DIGITAL' | 'PHYSICAL' | string;
  category: string | null;
  price: number | string;
  imageUrls: string[];
  guide: {
    slug: string;
    displayName: string;
    isFeatured?: boolean;
    avatarUrl: string | null;
  };
}

/** ProductCategory enum → human label. Matches the shop page. */
const CATEGORY_LABEL: Record<string, string> = {
  CRYSTALS:          'Crystals',
  SOUND_HEALING:     'Sound Healing',
  AROMATHERAPY:      'Aromatherapy',
  BOOKS_COURSES:     'Books & Courses',
  DIGITAL_DOWNLOADS: 'Digital Downloads',
  RITUAL_TOOLS:      'Ritual Tools',
  JEWELRY_MALAS:     'Jewelry & Malas',
  GIFT_BUNDLES:      'Gift Bundles',
  ART:               'Art',
};

/** "Digital · Meditation" style label. Falls back gracefully when category is unset. */
function formatTag(type: string, category: string | null): string {
  const typeLabel = type === 'DIGITAL' ? 'Digital' : 'Physical';
  if (!category) return typeLabel;
  // DIGITAL_DOWNLOADS is the generic catch-all category; pairing it with
  // the "Digital" type reads as "Digital · Digital Downloads" which is
  // visual noise. Just show the type in that case.
  if (category === 'DIGITAL_DOWNLOADS' && type === 'DIGITAL') return typeLabel;
  const catLabel = CATEGORY_LABEL[category] ?? category;
  return `${typeLabel} · ${catLabel}`;
}

function formatPrice(p: number | string) {
  const n = typeof p === 'string' ? parseFloat(p) : p;
  return `$${n.toFixed(0)}`;
}

interface Props {
  products?: Product[] | null;
}

export function ShopSection({ products }: Props) {
  // Hide the carousel entirely when we have no real products — showing
  // curated-looking demo cards to a shopper who then clicks through to
  // an empty storefront is worse than skipping the section.
  if (!products || products.length === 0) return null;

  const cards = products.map((p) => ({
    image: p.imageUrls?.[0] || '/images/ayurveda.jpg',
    imageAlt: p.name,
    tag: formatTag(p.type, p.category),
    tagVariant: 'default' as const,
    title: p.name,
    excerpt: p.description || '',
    avatarImage: p.guide.avatarUrl || '/images/logo.jpg',
    avatarAlt: p.guide.displayName,
    metaText: `By ${p.guide.displayName} · ${formatPrice(p.price)}`,
    editorsPick: !!p.guide.isFeatured,
    href: `/shop/${p.id}`,
  }));

  return (
    <section id="shop" style={{ padding: '60px 0 72px', background: '#FDF6E3' }}>
      <SectionHeader title="From the Shop" linkLabel="Browse All" linkHref="/shop" />

      <Carousel id="shop-feed">
        {cards.map((item, i) => (
          <div key={`${item.title}-${i}`} data-card>
            <FeedCard {...item} />
          </div>
        ))}
      </Carousel>
    </section>
  );
}
