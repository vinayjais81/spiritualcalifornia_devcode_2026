'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart.store';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  type: 'DIGITAL' | 'PHYSICAL';
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  badges?: string[];
  description?: string;
  guideName?: string;
}

export function ProductCard({
  id, name, price, originalPrice, category, type,
  imageUrl, rating, reviewCount, badges, description, guideName,
}: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      itemType: 'PRODUCT',
      itemId: id,
      name,
      price,
      quantity: 1,
      imageUrl,
      productType: type,
      guideName,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: '1px solid rgba(232,184,75,0.1)',
        borderRadius: 12, overflow: 'hidden',
        transition: 'box-shadow 0.3s, transform 0.3s',
        position: 'relative',
        boxShadow: hovered ? '0 10px 40px rgba(232,184,75,0.15)' : 'none',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      {/* Image */}
      <Link href={`/shop/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ position: 'relative', overflow: 'hidden', background: '#FDF6E3' }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              style={{
                width: '100%', height: 220, objectFit: 'cover', display: 'block',
                transition: 'transform 0.5s',
                transform: hovered ? 'scale(1.06)' : 'scale(1)',
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: 220,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 64,
            }}>
              {type === 'DIGITAL' ? '🎵' : '📦'}
            </div>
          )}

          {/* Badges */}
          {badges && badges.length > 0 && (
            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {badges.map((badge, i) => (
                <span key={i} style={{
                  display: 'inline-flex', padding: '4px 10px', borderRadius: 20,
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                  background: badge === 'New' ? '#3A3530' : badge === 'Bestseller' ? '#E8B84B' : 'rgba(255,255,255,0.9)',
                  color: badge === 'New' ? '#E8B84B' : badge === 'Bestseller' ? '#3A3530' : '#3A3530',
                  border: badge !== 'New' && badge !== 'Bestseller' ? '1px solid rgba(232,184,75,0.4)' : 'none',
                }}>
                  {badge}
                </span>
              ))}
              {discount > 0 && (
                <span style={{
                  display: 'inline-flex', padding: '4px 10px', borderRadius: 20,
                  fontSize: 10, fontWeight: 600, background: '#E53935', color: '#fff',
                }}>
                  {discount}% OFF
                </span>
              )}
            </div>
          )}

          {/* Wishlist button */}
          <button style={{
            position: 'absolute', top: 12, right: 12,
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            ♡
          </button>

          {/* Quick add */}
          <button
            onClick={handleQuickAdd}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: added ? '#5A8A6A' : '#3A3530', color: '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: 'none', cursor: 'pointer', padding: 12,
              transform: hovered ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.3s, background 0.2s',
            }}
          >
            {added ? '✓ Added!' : 'Quick Add to Cart'}
          </button>
        </div>
      </Link>

      {/* Body */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#8A8278', marginBottom: 6,
        }}>
          {category} {type === 'DIGITAL' && '· 🎧'}
        </div>
        <Link href={`/shop/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20, fontWeight: 500, color: '#3A3530',
            lineHeight: 1.3, marginBottom: 6,
          }}>
            {name}
          </h3>
        </Link>
        {description && (
          <p style={{
            fontSize: 12, color: '#8A8278', lineHeight: 1.6, marginBottom: 10,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
          }}>
            {description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#3A3530' }}>${price}</span>
            {originalPrice && (
              <span style={{ fontSize: 13, color: '#8A8278', textDecoration: 'line-through', marginLeft: 6 }}>
                ${originalPrice}
              </span>
            )}
          </div>
          {rating !== undefined && reviewCount !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#8A8278' }}>
              <span style={{ color: '#E8B84B', fontSize: 11 }}>★★★★★</span>
              ({reviewCount})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
