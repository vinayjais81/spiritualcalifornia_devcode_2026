'use client';

import Link from 'next/link';

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  imageUrl?: string;
  badge?: string;
}

interface HeroBannerProps {
  main: FeaturedProduct;
  side: FeaturedProduct[];
}

export function HeroBanner({ main, side }: HeroBannerProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 60 }}>
      {/* Main hero */}
      <Link href={`/shop/${main.id}`} style={{
        position: 'relative', borderRadius: 16, overflow: 'hidden',
        minHeight: 480, textDecoration: 'none', color: 'inherit', display: 'block',
      }}>
        {main.imageUrl ? (
          <img src={main.imageUrl} alt={main.name} style={{
            width: '100%', height: '100%', objectFit: 'cover',
            position: 'absolute', top: 0, left: 0,
          }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
            background: 'linear-gradient(135deg, #2C2420, #3A3530)',
          }} />
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(30,22,18,0.92) 0%, rgba(30,22,18,0.4) 60%, transparent 100%)',
          padding: '40px 36px',
        }}>
          {main.badge && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 20,
              background: '#E8B84B', color: '#3A3530',
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              ✦ {main.badge}
            </div>
          )}
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 8 }}>
            {main.category}
          </div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 32, fontWeight: 400, color: '#fff', lineHeight: 1.2, marginBottom: 8,
          }}>
            {main.name}
          </h2>
          {main.description && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 16 }}>
              {main.description}
            </p>
          )}
          <div style={{ fontSize: 22, fontWeight: 500, color: '#E8B84B', marginBottom: 16 }}>
            ${main.price}
          </div>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 8,
            background: '#E8B84B', color: '#3A3530',
            fontFamily: "'Inter', sans-serif",
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            border: 'none', cursor: 'pointer',
          }}>
            Add to Cart
          </button>
        </div>
      </Link>

      {/* Side cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {side.map((item) => (
          <Link key={item.id} href={`/shop/${item.id}`} style={{
            flex: 1, borderRadius: 12, overflow: 'hidden',
            position: 'relative', textDecoration: 'none', color: 'inherit',
            display: 'block', minHeight: 220,
          }}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} style={{
                width: '100%', height: '100%', objectFit: 'cover',
                position: 'absolute', top: 0, left: 0,
              }} />
            ) : (
              <div style={{
                width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
                background: 'linear-gradient(135deg, #3A3530, #2C2420)',
              }} />
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(30,22,18,0.88) 0%, transparent 100%)',
              padding: 20,
            }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 4 }}>
                {item.category}
              </div>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20, color: '#fff', marginBottom: 4,
              }}>
                {item.name}
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#E8B84B' }}>${item.price}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
