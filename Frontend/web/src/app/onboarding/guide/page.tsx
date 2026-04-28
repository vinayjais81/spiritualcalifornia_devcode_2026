import { Suspense } from 'react';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

// `OnboardingWizard` reads `useSearchParams()` (to honour `?resume=1`), which
// requires a Suspense boundary or Next.js bails out of static prerender. The
// page itself is still client-rendered; the boundary is what lets the build
// succeed without forcing the whole page into dynamic rendering.
export default function GuideOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingWizard />
    </Suspense>
  );
}
