import Link from 'next/link';

interface RelatedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  guideName?: string;
  guideAvatar?: string;
}

interface RelatedProductsProps {
  title: string;
  subtitle?: string;
  products: RelatedProduct[];
}

export function RelatedProducts({ title, subtitle, products }: RelatedProductsProps) {
  if (!products || products.length === 0) return null;

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 clamp(16px, 5vw, 60px) 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 26, fontWeight: 400, color: '#3A3530', marginBottom: 4,
        }}>
          {title}
        </h3>
        {subtitle && <p style={{ fontSize: 12, color: '#8A8278' }}>{subtitle}</p>}
      </div>
      <div className="sc-cards-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {products.slice(0, 4).map((p) => (
          <Link key={p.id} href={`/shop/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              background: '#fff', border: '1px solid rgba(240,120,20,0.1)',
              borderRadius: 12, overflow: 'hidden', transition: 'box-shadow 0.3s, transform 0.3s',
            }}>
              <div style={{ aspectRatio: '1/1', background: '#FEF7F0', overflow: 'hidden' }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 48,
                  }}>
                    ✨
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 16px' }}>
                {p.guideName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #F07814',
                      background: '#FEF7F0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 600, color: '#F07814', overflow: 'hidden',
                    }}>
                      {p.guideAvatar ? (
                        <img src={p.guideAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        p.guideName.split(' ').map(w => w[0]).join('').slice(0, 2)
                      )}
                    </div>
                    <span style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278' }}>
                      {p.guideName}
                    </span>
                  </div>
                )}
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 15, fontWeight: 500, color: '#3A3530', lineHeight: 1.3, marginBottom: 6,
                }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>${p.price}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
