'use client';

interface SizeSelectorProps {
  variants: Array<{ id: string; name: string; price?: number | null; stockQuantity: number; attributes?: any }>;
  selectedId: string | null;
  onChange: (id: string) => void;
}

export function SizeSelector({ variants, selectedId, onChange }: SizeSelectorProps) {
  if (!variants || variants.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: '#8A8278', marginBottom: 10,
      }}>
        Select Size
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {variants.map((v) => {
          const isActive = selectedId === v.id;
          const isOutOfStock = v.stockQuantity <= 0;
          return (
            <button
              key={v.id}
              onClick={() => !isOutOfStock && onChange(v.id)}
              disabled={isOutOfStock}
              style={{
                padding: '8px 16px', borderRadius: 8,
                fontSize: 12, fontWeight: isActive ? 500 : 400,
                background: isActive ? '#E8B84B' : '#fff',
                color: isActive ? '#3A3530' : isOutOfStock ? '#ccc' : '#3A3530',
                border: isActive ? '1.5px solid #E8B84B' : '1.5px solid rgba(232,184,75,0.2)',
                cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                textDecoration: isOutOfStock ? 'line-through' : 'none',
              }}
            >
              {v.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
