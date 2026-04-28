'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface CompletenessSection {
  key: string;
  label: string;
  filled: boolean;
}
interface Completeness {
  sections: CompletenessSection[];
  filledCount: number;
  totalSections: number;
  percent: number;
  isComplete: boolean;
}

const C = {
  gold: '#E8B84B',
  goldPale: '#FDF6E3',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
};

/**
 * Dashboard widget that nudges newly-onboarded seekers to fill in the
 * registration-wizard fields they skipped (interests, experience level,
 * practices, journey text, bio). Hides itself once the profile is 100%
 * complete so the dashboard isn't perpetually carrying it.
 *
 * Backend source of truth: GET /seekers/me → `completeness` block,
 * computed by SeekersService.computeProfileCompleteness.
 */
export function ProfileCompletenessWidget() {
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/seekers/me')
      .then((r) => setCompleteness(r.data?.completeness ?? null))
      .catch(() => setCompleteness(null))
      .finally(() => setLoading(false));
  }, []);

  // Skip rendering during the initial fetch and after completion. Don't
  // flash a loading skeleton — this widget is supplementary, not critical.
  if (loading || !completeness || completeness.isComplete) return null;

  const missing = completeness.sections.filter((s) => !s.filled);

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(232,184,75,0.25)',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 24,
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: C.gold,
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            ✦ Welcome to the journey
          </div>
          <h3
            style={{
              fontFamily: 'var(--font-cormorant-garamond), serif',
              fontSize: 22,
              fontWeight: 400,
              color: C.charcoal,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Your profile is{' '}
            <em style={{ fontStyle: 'italic', color: C.gold }}>
              {completeness.percent}% complete
            </em>
          </h3>
          <p
            style={{
              fontSize: 13,
              color: C.warmGray,
              margin: '6px 0 0',
              lineHeight: 1.6,
            }}
          >
            Add the remaining details to get personalised guide matches and a
            tailored AI-Guide experience.
          </p>
        </div>
        <Link
          href="/seeker/dashboard/profile"
          style={{
            flexShrink: 0,
            display: 'inline-block',
            padding: '10px 20px',
            background: C.charcoal,
            color: '#fff',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Complete Profile
        </Link>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          height: 6,
          background: 'rgba(232,184,75,0.15)',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${completeness.percent}%`,
            height: '100%',
            background: C.gold,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Section chips — checked vs to-do */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {completeness.sections.map((s) => (
          <span
            key={s.key}
            style={{
              padding: '4px 12px',
              borderRadius: 100,
              fontSize: 11,
              border: `1px solid ${s.filled ? 'transparent' : 'rgba(232,184,75,0.3)'}`,
              background: s.filled ? '#F0F7F1' : '#fff',
              color: s.filled ? '#5A8A6A' : C.warmGray,
              fontWeight: s.filled ? 500 : 400,
            }}
          >
            {s.filled ? '✓' : '○'} {s.label}
          </span>
        ))}
      </div>

      {missing.length > 0 && (
        <p
          style={{
            fontSize: 11,
            color: C.warmGray,
            margin: '12px 0 0',
            fontStyle: 'italic',
          }}
        >
          Still to add: {missing.map((s) => s.label).join(', ')}.
        </p>
      )}
    </div>
  );
}
