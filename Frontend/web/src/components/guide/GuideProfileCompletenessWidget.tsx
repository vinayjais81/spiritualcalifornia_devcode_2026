'use client';

import Link from 'next/link';

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

interface Props {
  completeness: Completeness | null | undefined;
  /** Surface "Resume guided setup →" link to /onboarding/guide?resume=1. */
  showResumeWizardLink?: boolean;
}

const C = {
  gold: '#E8B84B',
  goldPale: '#FDF6E3',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
};

// Map each section key to the dashboard sub-page where the guide can fill
// it in. Lets the widget render section chips as direct links rather than
// always sending the user to a single "complete profile" page.
const SECTION_HREF: Record<string, string> = {
  categories: '/guide/dashboard/profile',
  profile: '/guide/dashboard/profile',
  locationSchedule: '/guide/dashboard/location',
  credentials: '/guide/dashboard/verification',
  submittedForVerification: '/guide/dashboard/verification',
};

/**
 * Dashboard widget that nudges newly-onboarded guides to fill in the
 * registration-wizard fields they skipped (categories, profile basics,
 * location/schedule, credentials, submit-for-verification). Hides itself
 * once the profile is 100% complete.
 *
 * Backend source of truth: GET /guides/me → `completeness` block,
 * computed by GuidesService.computeProfileCompleteness.
 *
 * Stripe Connect (`stripeOnboardingDone`) is intentionally out-of-scope for
 * this widget — it's a separate post-approval lifecycle stage handled by
 * its own prompt on /guide/dashboard/earnings.
 */
export function GuideProfileCompletenessWidget({
  completeness,
  showResumeWizardLink = true,
}: Props) {
  // Render nothing while the parent is still loading or once we're at 100%.
  if (!completeness || completeness.isComplete) return null;

  const missing = completeness.sections.filter((s) => !s.filled);
  const firstMissingHref = missing[0]
    ? SECTION_HREF[missing[0].key] ?? '/guide/dashboard/profile'
    : '/guide/dashboard/profile';

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
            ✦ Finish setting up your practice
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
            Complete the remaining sections to submit for verification and
            start receiving bookings on Spiritual California.
          </p>
        </div>
        <Link
          href={firstMissingHref}
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
          Continue Setup
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

      {/* Section chips — each links to the relevant dashboard sub-page so the
          guide can fill that section directly. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {completeness.sections.map((s) => {
          const href = SECTION_HREF[s.key] ?? '/guide/dashboard/profile';
          return (
            <Link
              key={s.key}
              href={href}
              style={{
                padding: '4px 12px',
                borderRadius: 100,
                fontSize: 11,
                border: `1px solid ${s.filled ? 'transparent' : 'rgba(232,184,75,0.3)'}`,
                background: s.filled ? '#F0F7F1' : '#fff',
                color: s.filled ? '#5A8A6A' : C.warmGray,
                fontWeight: s.filled ? 500 : 400,
                textDecoration: 'none',
              }}
            >
              {s.filled ? '✓' : '○'} {s.label}
            </Link>
          );
        })}
      </div>

      {showResumeWizardLink && (
        <p
          style={{
            fontSize: 11,
            color: C.warmGray,
            margin: '12px 0 0',
          }}
        >
          Prefer a guided flow?{' '}
          <Link
            href="/onboarding/guide?resume=1"
            style={{ color: C.gold, textDecoration: 'none' }}
          >
            Resume guided setup →
          </Link>
        </p>
      )}
    </div>
  );
}
