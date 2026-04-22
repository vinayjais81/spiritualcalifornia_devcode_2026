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

/**
 * Fallback cards shown when the API returns nothing — matches the v3 design's
 * "From the Shop" carousel exactly (5 cards, one Editor's Pick, one Editor's
 * Choice with the orange tag variant).
 */
const STATIC_SHOP_ITEMS = [
  {
    image: '/images/ayurveda.jpg', imageAlt: '30-Day Awareness Training',
    tag: 'Digital · Meditation', tagVariant: 'default' as const,
    title: '30-Day Awareness Training',
    excerpt: 'A guided daily practice designed to rebuild your relationship with stillness, breath, and presence.',
    avatarImage: '/images/hero1.jpg', avatarAlt: 'Maya Rosenberg',
    metaText: 'By Maya Rosenberg · $48',
    editorsPick: true,
    href: '/shop',
  },
  {
    image: '/images/poppy_close.jpg', imageAlt: 'California Wildflower Herbal Blend',
    tag: 'Physical · Herbalism', tagVariant: 'default' as const,
    title: 'California Wildflower Herbal Blend',
    excerpt: 'Hand-crafted by a certified herbalist using locally foraged California botanicals to calm the nervous system.',
    avatarImage: '/images/hero3.jpg', avatarAlt: 'Priya Nair',
    metaText: 'By Priya Nair · $36',
    href: '/shop',
  },
  {
    image: '/images/hero3.jpg', imageAlt: 'Chakra Alignment Audio Series',
    tag: 'Digital · Energy Healing', tagVariant: 'default' as const,
    title: 'Chakra Alignment Audio Series',
    excerpt: 'Seven sessions of guided sound healing, one for each energy center, to restore flow and clarity.',
    avatarImage: '/images/hero2.jpg', avatarAlt: 'Serena Walsh',
    metaText: 'By Serena Walsh · $65',
    href: '/shop',
  },
  {
    image: '/images/hero2.jpg', imageAlt: 'The Spiritual California Gift Set',
    tag: 'Editor\u2019s Choice', tagVariant: 'editors' as const,
    title: 'The Spiritual California Gift Set',
    excerpt: 'A curated collection of our editors\u2019 favourite healing tools — crystals, teas, and guided audio — beautifully packaged.',
    avatarImage: '/images/logo.jpg', avatarAlt: 'Curated by Editors',
    metaText: 'Curated by Editors · $120',
    editorsPick: true,
    href: '/shop',
  },
  {
    image: '/images/yoga_outdoor.jpg', imageAlt: 'Sacred Geometry Silk Print',
    tag: 'Physical · Art', tagVariant: 'default' as const,
    title: 'Sacred Geometry Silk Print',
    excerpt: 'Hand-printed on natural silk by a Tibetan artist — a meditation object as much as a piece of art.',
    avatarImage: '/images/hero3.jpg', avatarAlt: 'Luna Park',
    metaText: 'By Luna Park · $95',
    href: '/shop',
  },
];

interface Props {
  products?: Product[] | null;
}

export function ShopSection({ products }: Props) {
  const cards = products && products.length > 0
    ? products.map((p) => ({
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
        // Link to the individual product detail page so the carousel behaves
        // like the design's "click anywhere on a card to open the product".
        href: `/shop/${p.id}`,
      }))
    : STATIC_SHOP_ITEMS;

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
