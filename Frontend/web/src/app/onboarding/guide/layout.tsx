import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Guide — Spiritual California',
  description: 'Complete your guide profile and get verified to start connecting with seekers.',
};

export default function GuideOnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
      {children}
    </div>
  );
}
