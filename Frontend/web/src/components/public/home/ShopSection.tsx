import { SectionHeader } from '@/components/public/shared/SectionHeader';
import { FeedCard } from '@/components/public/shared/FeedCard';
import { Carousel } from '@/components/public/shared/Carousel';

interface Product {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price: number | string;
  imageUrls: string[];
  guide: { slug: string; displayName: string; avatarUrl: string | null };
}

const staticShopItems = [
  { image: '/images/ayurveda.jpg', imageAlt: 'Product', tag: 'Digital · Meditation', tagVariant: 'default' as const, title: '30-Day Awareness Training', excerpt: 'A guided daily practice designed to rebuild your relationship with stillness, breath, and presence.', avatarImage: '/images/hero1.jpg', avatarAlt: 'Author', metaText: 'By Spiritual CA · $48' },
  { image: '/images/poppy_close.jpg', imageAlt: 'Product', tag: 'Physical · Herbalism', tagVariant: 'default' as const, title: 'California Wildflower Herbal Blend', excerpt: 'Hand-crafted by a certified herbalist using locally foraged California botanicals.', avatarImage: '/images/hero3.jpg', avatarAlt: 'Author', metaText: 'By Spiritual CA · $36' },
];

function formatPrice(p: number | string) {
  const n = typeof p === 'string' ? parseFloat(p) : p;
  return `$${n.toFixed(0)}`;
}

interface Props {
  products?: Product[] | null;
}

export function ShopSection({ products }: Props) {
  const cards = products && products.length > 0
    ? products.map(p => ({
        image: p.imageUrls[0] || '/images/ayurveda.jpg',
        imageAlt: p.name,
        tag: `${p.type === 'DIGITAL' ? 'Digital' : 'Physical'}`,
        tagVariant: 'default' as const,
        title: p.name,
        excerpt: p.description || '',
        avatarImage: p.guide.avatarUrl || '/images/logo.jpg',
        avatarAlt: p.guide.displayName,
        metaText: `By ${p.guide.displayName} · ${formatPrice(p.price)}`,
        href: `/shop`,
      }))
    : staticShopItems.map(s => ({ ...s, href: '/shop' }));

  return (
    <section id="shop" style={{ padding: '60px 0 72px', background: '#FDF6E3' }}>
      <SectionHeader title="From the Shop" linkLabel="Browse All" linkHref="/shop" />

      <Carousel id="shop-feed">
        {cards.map(item => (
          <div key={item.title} data-card>
            <FeedCard {...item} />
          </div>
        ))}
      </Carousel>
    </section>
  );
}
