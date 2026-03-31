'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/cart.store';
import { CreatorCard } from '@/components/public/shop/CreatorCard';
import { ImageGallery } from '@/components/public/shop/ImageGallery';
import { SizeSelector } from '@/components/public/shop/SizeSelector';
import { ProductTabs } from '@/components/public/shop/ProductTabs';
import { ReviewsSection } from '@/components/public/shop/ReviewsSection';
import { RelatedProducts } from '@/components/public/shop/RelatedProducts';

interface ProductVariant {
  id: string;
  name: string;
  price: number | null;
  stockQuantity: number;
  attributes: any;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  type: 'DIGITAL' | 'PHYSICAL';
  price: number;
  currency: string;
  imageUrls: string[];
  fileS3Key: string | null;
  digitalFiles: any;
  shippingInfo: any;
  stockQuantity: number | null;
  guide: {
    id: string;
    slug: string;
    displayName: string;
    isVerified: boolean;
    tagline?: string;
    user: { avatarUrl: string | null };
  };
  variants: ProductVariant[];
}

// Fallback product for demo
const fallbackDigital: Product = {
  id: 'demo-digital', name: '432 Hz Deep Sleep Meditation', description: 'A 47-minute guided journey combining binaural beats, crystal bowl frequencies, and gentle voice guidance. Designed to quiet the mind and guide you into deep, restorative sleep.\n\nThis recording uses scientifically-tuned 432 Hz frequencies paired with delta wave entrainment to naturally slow brainwave activity. The crystal bowl accompaniment adds harmonic overtones that many listeners describe as deeply soothing.',
  type: 'DIGITAL', price: 24, currency: 'USD', imageUrls: [], fileS3Key: null,
  digitalFiles: [{ name: 'deep-sleep-432hz.mp3', size: '87 MB', format: 'MP3 320kbps' }],
  shippingInfo: null, stockQuantity: null,
  guide: { id: 'g1', slug: 'maya-williams', displayName: 'Maya Williams, Reiki Master', isVerified: true, tagline: 'Sound Healer & Energy Practitioner', user: { avatarUrl: null } },
  variants: [],
};

const fallbackPhysical: Product = {
  id: 'demo-physical', name: 'Shamanic Mirror Ring — Sterling Silver', description: 'A handcrafted sterling silver ring featuring a polished obsidian mirror, inspired by ancient Mesoamerican shamanic traditions. The obsidian mirror was used by healers and seers as a tool for scrying, self-reflection, and spiritual protection.\n\nEach ring is individually cast using the lost-wax method, ensuring subtle uniqueness in every piece. The obsidian is hand-polished to a deep, reflective finish.',
  type: 'PHYSICAL', price: 145, currency: 'USD', imageUrls: [], fileS3Key: null,
  digitalFiles: null, shippingInfo: { weight: '18g', material: 'Sterling Silver 925 · Obsidian' },
  stockQuantity: 3,
  guide: { id: 'g2', slug: 'carlos-mendez', displayName: 'Carlos Mendez, QiGong Sifu', isVerified: true, tagline: 'Artisan Jeweler & Energy Worker', user: { avatarUrl: null } },
  variants: [
    { id: 'v5', name: '5', price: null, stockQuantity: 2, attributes: { size: '5' } },
    { id: 'v6', name: '6', price: null, stockQuantity: 3, attributes: { size: '6' } },
    { id: 'v7', name: '7', price: null, stockQuantity: 1, attributes: { size: '7' } },
    { id: 'v8', name: '8', price: null, stockQuantity: 2, attributes: { size: '8' } },
    { id: 'v9', name: '9', price: null, stockQuantity: 0, attributes: { size: '9' } },
    { id: 'v10', name: '10', price: null, stockQuantity: 1, attributes: { size: '10' } },
    { id: 'v11', name: '11', price: null, stockQuantity: 2, attributes: { size: '11' } },
    { id: 'vcustom', name: 'Custom', price: 25, stockQuantity: 99, attributes: { size: 'Custom' } },
  ],
};

const demoReviews = [
  { id: 'r1', authorName: 'Sarah K.', rating: 5, body: 'This has completely transformed my sleep routine. I fall asleep within minutes now.', date: 'Mar 2026', verified: true },
  { id: 'r2', authorName: 'David N.', rating: 5, body: 'The crystal bowl frequencies are incredible. You can feel them resonating through your whole body.', date: 'Feb 2026', verified: true },
  { id: 'r3', authorName: 'Emily W.', rating: 4, body: 'Beautiful recording. I use it every night. Would love a longer version!', date: 'Jan 2026', verified: true },
];

const demoRelated = [
  { id: '1', name: 'Himalayan Singing Bowl Set', price: 285, guideName: 'Luna Rivera' },
  { id: '2', name: 'Amethyst Cluster — Large', price: 89, guideName: 'Dr. Sarah Chen' },
  { id: '3', name: 'Sacred Geometry Oracle Deck', price: 48, guideName: 'Rebecca Stone' },
  { id: '4', name: 'Lavender Sage Bundle', price: 18, guideName: 'Elena Vasquez' },
];

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      itemType: 'PRODUCT',
      itemId: product.id,
      variantId: selectedVariant || undefined,
      name: product.name,
      price: activePrice,
      quantity,
      imageUrl: product.imageUrls?.[0],
      productType: product.type,
      guideName: product.guide.displayName,
      variantName: selectedVariant ? product.variants.find(v => v.id === selectedVariant)?.name : undefined,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${productId}`);
        setProduct(res.data);
      } catch {
        // Use fallback based on ID pattern
        if (productId.includes('digital') || productId === 'demo-digital') {
          setProduct(fallbackDigital);
        } else {
          setProduct(fallbackPhysical);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '100px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80 }}>
          <div style={{ aspectRatio: '1/1', background: '#FDF6E3', borderRadius: 16 }} />
          <div>
            <div style={{ height: 16, background: '#f0eeeb', borderRadius: 4, width: '30%', marginBottom: 16 }} />
            <div style={{ height: 40, background: '#f0eeeb', borderRadius: 4, width: '80%', marginBottom: 12 }} />
            <div style={{ height: 20, background: '#f0eeeb', borderRadius: 4, width: '50%', marginBottom: 32 }} />
            <div style={{ height: 80, background: '#f0eeeb', borderRadius: 8, marginBottom: 24 }} />
            <div style={{ height: 36, background: '#f0eeeb', borderRadius: 4, width: '40%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return <div style={{ padding: 100, textAlign: 'center' }}>Product not found</div>;

  const isDigital = product.type === 'DIGITAL';
  const activePrice = selectedVariant
    ? (product.variants.find(v => v.id === selectedVariant)?.price ?? product.price)
    : product.price;

  const digitalTabs = [
    { label: 'Description', content: (product.description || '').replace(/\n/g, '<br/>') },
  ];

  const physicalTabs = [
    { label: 'The Story', content: (product.description || '').replace(/\n/g, '<br/>') },
    { label: 'Materials', content: product.shippingInfo?.material ? `<p>Crafted from ${product.shippingInfo.material}.</p><p>Each piece is individually made using traditional lost-wax casting, ensuring subtle uniqueness.</p>` : '<p>Details coming soon.</p>' },
    { label: 'Shipping', content: '<p>Free worldwide shipping on all orders.</p><p><strong>Standard:</strong> 7-14 business days</p><p><strong>Express:</strong> 3-5 business days (+$28)</p><p>Made-to-order items ship within 3-5 weeks.</p>' },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 60px 0' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278' }}>
          <Link href="/" style={{ color: '#8A8278', textDecoration: 'none' }}>Home</Link>
          {' › '}
          <Link href="/shop" style={{ color: '#8A8278', textDecoration: 'none' }}>Shop</Link>
          {' › '}
          <span style={{ color: '#3A3530' }}>{product.name}</span>
        </div>
      </div>

      {/* Product Layout */}
      <div style={{
        maxWidth: 1300, margin: '0 auto',
        padding: '40px 60px 80px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80,
      }}>
        {/* LEFT — Image / Gallery */}
        <div>
          {isDigital ? (
            <div style={{ position: 'sticky', top: 90 }}>
              <div style={{
                aspectRatio: '1/1', borderRadius: 16, overflow: 'hidden',
                background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {product.imageUrls[0] ? (
                  <img src={product.imageUrls[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 120 }}>🎵</span>
                )}
                <span style={{
                  position: 'absolute', bottom: 20, left: 20,
                  padding: '6px 14px', borderRadius: 20,
                  background: '#3A3530', color: '#E8B84B',
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Digital Download
                </span>
              </div>
              {/* Meta tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {['Audio · MP3', '47 Minutes', 'Instant Access', 'Lifetime Download'].map((tag, i) => (
                  <span key={i} style={{
                    padding: '5px 12px', borderRadius: 20,
                    background: '#fff', border: '1px solid rgba(232,184,75,0.15)',
                    fontSize: 11, color: '#8A8278',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <ImageGallery
              images={product.imageUrls}
              alt={product.name}
              badges={['Handmade', 'One of a Kind']}
            />
          )}
        </div>

        {/* RIGHT — Product Info */}
        <div>
          {/* Category */}
          <div style={{
            fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#E8B84B', marginBottom: 10,
          }}>
            {isDigital ? 'Digital Download' : 'Jewelry & Art · Handmade'}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(28px, 3.5vw, 44px)',
            fontWeight: 400, color: '#3A3530', lineHeight: 1.15, marginBottom: 6,
          }}>
            {product.name}
          </h1>

          {/* Subtitle (physical only) */}
          {!isDigital && (
            <p style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18, fontStyle: 'italic', color: '#8A8278',
              marginBottom: 20,
            }}>
              Handcrafted obsidian mirror ring with sacred geometry
            </p>
          )}

          {/* Rating (physical only) */}
          {!isDigital && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ color: '#E8B84B', fontSize: 14 }}>★★★★★</span>
              <span style={{ fontSize: 12, color: '#8A8278' }}>5.0 · 12 reviews</span>
            </div>
          )}

          {/* Creator card */}
          <div style={{ marginBottom: 24 }}>
            <CreatorCard
              slug={product.guide.slug}
              displayName={product.guide.displayName}
              tagline={product.guide.tagline}
              avatarUrl={product.guide.user.avatarUrl || undefined}
              isVerified={product.guide.isVerified}
              compact={!isDigital}
            />
          </div>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: isDigital ? 24 : 8 }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: isDigital ? 38 : 42, fontWeight: isDigital ? 500 : 400, color: '#3A3530',
            }}>
              ${activePrice}
            </span>
          </div>

          {/* Stock / shipping note (physical) */}
          {!isDigital && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 4 }}>
                Free worldwide shipping · Made to order
              </div>
              {product.stockQuantity !== null && product.stockQuantity <= 5 && (
                <div style={{ fontSize: 12, color: '#C0392B', fontStyle: 'italic' }}>
                  Only {product.stockQuantity} available — order soon
                </div>
              )}
            </div>
          )}

          {/* What's Included (digital) */}
          {isDigital && (
            <div style={{
              background: '#FDF6E3', border: '1px solid #F5D98A',
              borderRadius: 12, padding: '20px 24px', marginBottom: 24,
            }}>
              <div style={{
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#8A8278', marginBottom: 12,
              }}>
                What&apos;s Included
              </div>
              {[
                'High-quality MP3 audio file (320 kbps)',
                '47 minutes of guided meditation',
                'Instant digital download',
                'Lifetime access — re-download anytime',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ color: '#E8B84B', fontSize: 16 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#3A3530' }}>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Size selector (physical with variants) */}
          {!isDigital && product.variants.length > 0 && (
            <SizeSelector
              variants={product.variants}
              selectedId={selectedVariant}
              onChange={setSelectedVariant}
            />
          )}

          {/* Quantity */}
          {!isDigital && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A8278' }}>
                Qty
              </span>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(232,184,75,0.2)', borderRadius: 8 }}>
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{
                  padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#3A3530',
                }}>−</button>
                <span style={{ padding: '8px 16px', fontSize: 14, fontWeight: 500, minWidth: 40, textAlign: 'center' }}>{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} style={{
                  padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#3A3530',
                }}>+</button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={handleAddToCart}
            style={{
              width: '100%', padding: 18, borderRadius: 10,
              background: '#3A3530', color: '#E8B84B',
              fontFamily: "'Inter', sans-serif",
              fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: 'none', cursor: 'pointer', marginBottom: 12,
              transition: 'background 0.2s',
            }}
          >
            {isDigital ? 'Buy Now — Instant Download' : 'Buy Now'}
          </button>
          <button
            onClick={handleAddToCart}
            style={{
              width: '100%', padding: 17, borderRadius: 10,
              background: addedToCart ? 'rgba(90,138,106,0.1)' : 'transparent',
              color: addedToCart ? '#5A8A6A' : '#3A3530',
              fontFamily: "'Inter', sans-serif",
              fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: addedToCart ? '1.5px solid #5A8A6A' : '1.5px solid #3A3530',
              cursor: 'pointer', marginBottom: 24,
              transition: 'all 0.2s',
            }}
          >
            {addedToCart ? '✓ Added to Cart' : isDigital ? 'Save for Later' : 'Add to Cart'}
          </button>

          {/* Secure note */}
          <div style={{ fontSize: 11, color: '#8A8278', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
            🔒 Secured by <span style={{ color: '#E8B84B' }}>Stripe</span>
            {isDigital ? ' · Instant delivery' : ' · Free shipping'}
          </div>

          {/* Feature badges (physical) */}
          {!isDigital && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
              {[
                { icon: '💎', title: 'Sterling Silver', sub: '925 hallmarked' },
                { icon: '✦', title: '18K Gold Accent', sub: 'Hand-applied' },
                { icon: '🔮', title: 'Natural Obsidian', sub: 'Ethically sourced' },
                { icon: '🤲', title: 'Made to Order', sub: '3-5 weeks' },
              ].map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: 12,
                  background: '#FAFAF7', border: '1px solid rgba(232,184,75,0.1)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 22 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#3A3530' }}>{f.title}</div>
                    <div style={{ fontSize: 10, color: '#8A8278' }}>{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <ProductTabs tabs={isDigital ? digitalTabs : physicalTabs} />
        </div>
      </div>

      {/* Reviews */}
      <ReviewsSection
        reviews={demoReviews}
        averageRating={4.8}
        totalReviews={demoReviews.length}
        columns={isDigital ? 3 : 2}
      />

      {/* Related Products */}
      <RelatedProducts
        title={`More by ${product.guide.displayName.split(',')[0]}`}
        subtitle="From the same practitioner"
        products={demoRelated}
      />
    </>
  );
}
