'use client';

import { useState } from 'react';

interface Tab {
  label: string;
  content: string;
}

interface ProductTabsProps {
  tabs: Tab[];
}

export function ProductTabs({ tabs }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (!tabs || tabs.length === 0) return null;

  return (
    <div style={{ borderTop: '1px solid rgba(232,184,75,0.15)', marginTop: 32 }}>
      {/* Tab headers */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '14px 20px',
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontWeight: activeTab === i ? 600 : 400,
              color: activeTab === i ? '#3A3530' : '#8A8278',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === i ? '2px solid #E8B84B' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        padding: '20px 0', fontSize: 14, color: '#3A3530',
        lineHeight: 1.8,
      }}>
        <div dangerouslySetInnerHTML={{ __html: tabs[activeTab].content }} />
      </div>
    </div>
  );
}
