'use client';

import { useState, useEffect } from 'react';
import { AIFinderBar } from '@/components/public/shop/AIFinderBar';
import { CategoryStrip } from '@/components/public/shop/CategoryStrip';
import { HeroBanner } from '@/components/public/shop/HeroBanner';
import { ProductCard } from '@/components/public/shop/ProductCard';
import { PromoBanner } from '@/components/public/shop/PromoBanner';
import { TrustStrip } from '@/components/public/shop/TrustStrip';
import { api } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  description: string | null;
  type: 'DIGITAL' | 'PHYSICAL';
  category?: string | null;
  price: number;
  imageUrls: string[];
  isActive: boolean;
  guide: {
    displayName: string;
    slug: string;
  };
}

// Map CategoryStrip UI keys → backend ProductCategory enum.
// 'all' and 'digital' are handled separately (no category param for 'all';
// 'digital' maps to type=DIGITAL for back-compat with the old UI behaviour).
const CATEGORY_ENUM_MAP: Record<string, string> = {
  crystals:      'CRYSTALS',
  sound:         'SOUND_HEALING',
  aromatherapy:  'AROMATHERAPY',
  books:         'BOOKS_COURSES',
  tools:         'RITUAL_TOOLS',
  jewelry:       'JEWELRY_MALAS',
  bundles:       'GIFT_BUNDLES',
  art:           'ART',
  // 'digital' intentionally absent — treated as a type filter below
};

const CATEGORY_LABEL: Record<string, string> = {
  all:          'All Products',
  crystals:     'Crystals',
  sound:        'Sound Healing',
  aromatherapy: 'Aromatherapy',
  books:        'Books & Courses',
  digital:      'Digital Downloads',
  tools:        'Ritual Tools',
  jewelry:      'Jewelry & Malas',
  bundles:      'Gift Bundles',
  art:          'Art',
};

// Fallback data while API loads or if not yet populated
const fallbackProducts: Product[] = [
  { id: '1', name: 'Himalayan Singing Bowl Set — Full Chakra', description: 'Seven hand-hammered bowls, each tuned to a specific chakra frequency.', type: 'PHYSICAL', price: 285, imageUrls: [], isActive: true, guide: { displayName: 'Luna Rivera', slug: 'luna-rivera' } },
  { id: '2', name: 'Amethyst Cluster — Large', description: 'Natural amethyst geode, ethically sourced from Brazilian mines.', type: 'PHYSICAL', price: 89, imageUrls: [], isActive: true, guide: { displayName: 'Dr. Sarah Chen', slug: 'dr-sarah-chen' } },
  { id: '3', name: '432 Hz Deep Sleep Meditation', description: '47-minute guided journey with binaural beats and crystal bowl accompaniment.', type: 'DIGITAL', price: 24, imageUrls: [], isActive: true, guide: { displayName: 'Maya Williams', slug: 'maya-williams' } },
  { id: '4', name: 'Shamanic Mirror Ring — Sterling Silver', description: 'Handcrafted obsidian mirror ring with sacred geometry.', type: 'PHYSICAL', price: 145, imageUrls: [], isActive: true, guide: { displayName: 'Carlos Mendez', slug: 'carlos-mendez' } },
  { id: '5', name: 'Sacred Geometry Oracle Deck', description: '44 cards with guidebook. Printed on recycled cotton paper with gold foil edges.', type: 'PHYSICAL', price: 48, imageUrls: [], isActive: true, guide: { displayName: 'Rebecca Stone', slug: 'rebecca-stone' } },
  { id: '6', name: 'Lavender Sage Smudge Bundle', description: 'Hand-tied California white sage and French lavender.', type: 'PHYSICAL', price: 18, imageUrls: [], isActive: true, guide: { displayName: 'Elena Vasquez', slug: 'elena-vasquez' } },
  { id: '7', name: 'Chakra Alignment Program — Video Course', description: '7-week self-paced program with 14 HD video lessons.', type: 'DIGITAL', price: 89, imageUrls: [], isActive: true, guide: { displayName: 'Priya Sharma', slug: 'priya-sharma' } },
  { id: '8', name: 'Hand-Poured Intention Candle — Abundance', description: 'Soy wax candle infused with citrine chips and cinnamon essential oil.', type: 'PHYSICAL', price: 32, imageUrls: [], isActive: true, guide: { displayName: 'James O\'Brien', slug: 'james-obrien' } },
];

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Build query: 'digital' tab maps to type=DIGITAL; all other keys map
        // to the ProductCategory enum; 'all' sends no filter.
        const params: Record<string, string | number> = { limit: 50 };
        if (activeCategory === 'digital') {
          params.type = 'DIGITAL';
        } else if (CATEGORY_ENUM_MAP[activeCategory]) {
          params.category = CATEGORY_ENUM_MAP[activeCategory];
        }

        const res = await api.get('/products/public', { params });
        // Backend returns { products, total, page, totalPages }
        const items: Product[] = Array.isArray(res.data)
          ? res.data
          : res.data?.products ?? [];
        if (items.length > 0) {
          setProducts(items);
        } else {
          // No results for this filter — clear the grid (don't fall back to demo data,
          // since that would misleadingly show unrelated products under a category).
          setProducts(activeCategory === 'all' ? fallbackProducts : []);
        }
      } catch {
        // API not ready — only show fallback on the 'all' tab; otherwise empty state.
        setProducts(activeCategory === 'all' ? fallbackProducts : []);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [activeCategory]);

  // Filtering happens server-side now; keep this a pass-through so
  // we can still layer client-side features (sort, etc.) cleanly.
  const filteredProducts = products;

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    return 0; // newest is default order
  });

  const heroMain = {
    id: products[0]?.id || '1',
    name: products[0]?.name || 'Himalayan Singing Bowl Set',
    price: products[0]?.price || 285,
    category: 'Sound Healing',
    description: products[0]?.description || '',
    badge: 'New Collection',
  };

  const heroSide = [
    { id: products[1]?.id || '2', name: products[1]?.name || 'Amethyst Cluster', price: products[1]?.price || 89, category: 'Crystals' },
    { id: products[2]?.id || '3', name: products[2]?.name || 'Deep Sleep Meditation', price: products[2]?.price || 24, category: 'Digital Downloads' },
  ];

  return (
    <>
      {/* AI Finder Bar */}
      <AIFinderBar />

      {/* Category Strip */}
      <CategoryStrip active={activeCategory} onChange={setActiveCategory} />

      {/* Store Body */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 48px 80px' }}>

        {/* Hero Banner */}
        <HeroBanner main={heroMain} side={heroSide} />

        {/* Section Header + Sort */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
            color: '#E8B84B', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            Shop All
            <span style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 32, fontWeight: 400, color: '#3A3530',
            }}>
              {CATEGORY_LABEL[activeCategory] ?? 'All Products'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12, color: '#8A8278' }}>{sortedProducts.length} items</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  border: '1px solid rgba(232,184,75,0.2)', background: '#fff',
                  fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#3A3530',
                  cursor: 'pointer',
                }}
              >
                <option value="newest">Newest</option>
                <option value="popular">Popular</option>
                <option value="price-low">Price: Low → High</option>
                <option value="price-high">Price: High → Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
          }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 12, overflow: 'hidden',
                border: '1px solid rgba(232,184,75,0.1)',
              }}>
                <div style={{ height: 220, background: '#FDF6E3', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ height: 12, background: '#f0eeeb', borderRadius: 4, marginBottom: 8, width: '60%' }} />
                  <div style={{ height: 18, background: '#f0eeeb', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 12, background: '#f0eeeb', borderRadius: 4, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
          }}>
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                category={product.guide?.displayName || 'Spiritual California'}
                type={product.type}
                imageUrl={product.imageUrls?.[0]}
                description={product.description || undefined}
                badges={product.type === 'DIGITAL' ? ['Digital'] : undefined}
                guideName={product.guide?.displayName}
              />
            ))}
          </div>
        )}

        {/* Promo Banner */}
        <div style={{ marginTop: 60 }}>
          <PromoBanner />
        </div>

        {/* Trust Strip */}
        <TrustStrip />

        {/* Testimonial */}
        <div style={{
          background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)',
          borderRadius: 16, padding: '40px 48px', marginBottom: 60, textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 16 }}>
            ✦ What Our Community Says
          </div>
          <div style={{ color: '#E8B84B', fontSize: 18, marginBottom: 12 }}>★★★★★</div>
          <blockquote style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, fontWeight: 400, fontStyle: 'italic',
            color: '#3A3530', lineHeight: 1.5, maxWidth: 680,
            margin: '0 auto 20px',
          }}>
            &ldquo;Every item I&apos;ve purchased has been thoughtfully made and spiritually aligned. The singing bowl set transformed my morning practice completely.&rdquo;
          </blockquote>
          <div style={{ fontSize: 13, color: '#8A8278' }}>
            — Jessica M., San Jose, CA
          </div>
        </div>
      </div>
    </>
  );
}
