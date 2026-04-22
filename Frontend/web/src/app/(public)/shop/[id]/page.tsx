'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

interface ReviewApiShape {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  date: string;
  verified?: boolean;
}

interface RelatedApiShape {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  guideName?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState<ReviewApiShape[]>([]);
  const [related, setRelated] = useState<RelatedApiShape[]>([]);
  const addItem = useCartStore((s) => s.addItem);

  // Add the current product to the cart. Shared by "Add to Cart" and "Buy Now";
  // the caller decides whether to navigate afterwards.
  const addCurrentProduct = () => {
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
  };

  const handleAddToCart = () => {
    addCurrentProduct();
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  // Buy Now = add to cart + jump straight to checkout. Industry-standard single-click buy flow.
  const handleBuyNow = () => {
    addCurrentProduct();
    router.push('/checkout');
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${productId}`);
        setProduct(res.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  // Reviews and related products are best-effort — the endpoints may not be
  // wired up yet, in which case we silently render empty states rather than
  // surfacing errors to the shopper.
  useEffect(() => {
    if (!product) return;
    (async () => {
      try {
        const res = await api.get(`/products/${product.id}/reviews`);
        setReviews(Array.isArray(res.data) ? res.data : res.data?.reviews ?? []);
      } catch {
        setReviews([]);
      }
    })();
    (async () => {
      try {
        const res = await api.get(`/products/${product.id}/related`);
        setRelated(Array.isArray(res.data) ? res.data : res.data?.products ?? []);
      } catch {
        setRelated([]);
      }
    })();
  }, [product]);

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

  if (!product || notFound) return <div style={{ padding: 100, textAlign: 'center' }}>Product not found</div>;

  const averageRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

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

          {/* Rating (physical only) — hidden until the product has any reviews */}
          {!isDigital && reviews.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ color: '#E8B84B', fontSize: 14 }}>
                {'★'.repeat(Math.round(averageRating))}{'☆'.repeat(5 - Math.round(averageRating))}
              </span>
              <span style={{ fontSize: 12, color: '#8A8278' }}>
                {averageRating.toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </span>
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
            onClick={handleBuyNow}
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
            {addedToCart ? '✓ Added to Cart' : 'Add to Cart'}
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

      {/* Reviews — only render once we have data from the backend */}
      {reviews.length > 0 && (
        <ReviewsSection
          reviews={reviews}
          averageRating={averageRating}
          totalReviews={reviews.length}
          columns={isDigital ? 3 : 2}
        />
      )}

      {/* Related Products — RelatedProducts already no-ops on empty */}
      <RelatedProducts
        title={`More by ${product.guide.displayName.split(',')[0]}`}
        subtitle="From the same practitioner"
        products={related}
      />
    </>
  );
}
