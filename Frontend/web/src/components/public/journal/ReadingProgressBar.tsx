'use client';

import { useState, useEffect } from 'react';

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const articleBody = document.querySelector('.article-body');
      if (!articleBody) return;
      const rect = articleBody.getBoundingClientRect();
      const total = rect.height;
      const scrolled = Math.max(0, -rect.top);
      const pct = Math.min(100, (scrolled / total) * 100);
      setProgress(pct);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 69, left: 0, right: 0, zIndex: 95,
      height: 3, background: 'rgba(232,184,75,0.1)',
    }}>
      <div style={{
        height: '100%', background: '#E8B84B',
        width: `${progress}%`, transition: 'width 0.1s linear',
      }} />
    </div>
  );
}
