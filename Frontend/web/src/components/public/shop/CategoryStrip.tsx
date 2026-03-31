'use client';

const categories = [
  { key: 'all', label: 'All', icon: '✦' },
  { key: 'crystals', label: 'Crystals', icon: '💎' },
  { key: 'sound', label: 'Sound Healing', icon: '🔔' },
  { key: 'aromatherapy', label: 'Aromatherapy', icon: '🌿' },
  { key: 'books', label: 'Books & Courses', icon: '📚' },
  { key: 'digital', label: 'Digital Downloads', icon: '🎧' },
  { key: 'tools', label: 'Ritual Tools', icon: '🕯️' },
  { key: 'jewelry', label: 'Jewelry & Malas', icon: '📿' },
  { key: 'bundles', label: 'Gift Bundles', icon: '🎁' },
  { key: 'art', label: 'Art', icon: '🎨' },
];

interface CategoryStripProps {
  active: string;
  onChange: (key: string) => void;
}

export function CategoryStrip({ active, onChange }: CategoryStripProps) {
  return (
    <div style={{
      background: '#fff',
      borderBottom: '1px solid rgba(232,184,75,0.1)',
      position: 'sticky', top: 69, zIndex: 90,
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflowX: 'auto', scrollbarWidth: 'none' as const,
      }}>
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '14px 16px',
              fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: active === cat.key ? '#3A3530' : '#8A8278',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: active === cat.key ? '2px solid #E8B84B' : '2px solid transparent',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 20 }}>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
