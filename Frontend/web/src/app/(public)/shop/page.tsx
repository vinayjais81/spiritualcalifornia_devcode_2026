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

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 50 };
        if (activeCategory === 'digital') {
          params.type = 'DIGITAL';
        } else if (CATEGORY_ENUM_MAP[activeCategory]) {
          params.category = CATEGORY_ENUM_MAP[activeCategory];
        }

        const res = await api.get('/products/public', { params });
        const items: Product[] = Array.isArray(res.data)
          ? res.data
          : res.data?.products ?? [];
        setProducts(items);
      } catch {
        setProducts([]);
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

  // The hero block features the first three real products. Skip the banner
  // entirely until the catalogue has at least three items — a half-filled
  // hero looks broken and placeholder product names are misleading.
  const heroReady = products.length >= 3;
  const heroCategoryFor = (p: Product) =>
    p.category ? CATEGORY_LABEL[p.category.toLowerCase()] ?? p.category : p.type === 'DIGITAL' ? 'Digital Downloads' : 'Featured';
  const heroMain = heroReady
    ? {
        id: products[0].id,
        name: products[0].name,
        price: products[0].price,
        category: heroCategoryFor(products[0]),
        description: products[0].description || '',
        imageUrl: products[0].imageUrls?.[0],
        badge: 'Featured',
      }
    : null;
  const heroSide = heroReady
    ? [1, 2].map((i) => ({
        id: products[i].id,
        name: products[i].name,
        price: products[i].price,
        category: heroCategoryFor(products[i]),
        imageUrl: products[i].imageUrls?.[0],
      }))
    : [];

  return (
    <>
      {/* AI Finder Bar */}
      <AIFinderBar />

      {/* Category Strip */}
      <CategoryStrip active={activeCategory} onChange={setActiveCategory} />

      {/* Store Body */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 48px 80px' }}>

        {/* Hero Banner — only shown once we have ≥3 real products */}
        {heroMain && <HeroBanner main={heroMain} side={heroSide} />}

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
