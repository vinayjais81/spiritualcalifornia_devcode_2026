'use client';

import { WizardStep } from '@/types/onboarding';

// Step 0 (Account) is pre-wizard and NOT shown here.
// Steps 1-7 match the v3 design progress bar.
const STEPS: Array<{ number: number; label: string; isSpecial?: boolean }> = [
  { number: 1, label: 'Profile' },
  { number: 2, label: 'Services' },
  { number: 3, label: 'Credentials' },
  { number: 4, label: 'Verify Identity' },
  { number: 5, label: 'Calendar & Pricing' },
  { number: 6, label: 'Products & Events' },
  { number: 7, label: 'Go Live', isSpecial: true },
];

interface Props {
  currentStep: WizardStep;
  completedSteps: number[];
}

export function ProgressStepper({ currentStep, completedSteps }: Props) {
  // Don't show stepper on account step
  if (currentStep === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        minWidth: '800px',
      }}
    >
      {STEPS.map((step, i) => {
        const isCompleted = completedSteps.includes(step.number) || currentStep > step.number;
        const isCurrent = currentStep === step.number;
        const isLast = i === STEPS.length - 1;

        return (
          <div key={step.number} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 20px 14px 0',
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: isCompleted ? '#E8B84B' : isCurrent ? '#3A3530' : '#C4BDB5',
                whiteSpace: 'nowrap',
                transition: 'color 0.3s',
              }}
            >
              {/* Step number circle */}
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: isCompleted
                    ? '1.5px solid #E8B84B'
                    : isCurrent
                    ? '1.5px solid #3A3530'
                    : '1.5px solid #C4BDB5',
                  background: isCompleted ? '#E8B84B' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: step.isSpecial ? '10px' : '10px',
                  fontWeight: 500,
                  color: isCompleted ? '#FFFFFF' : isCurrent ? '#3A3530' : '#C4BDB5',
                  flexShrink: 0,
                  transition: 'all 0.3s',
                }}
              >
                {isCompleted ? (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 5.5l2.5 2.5L9 3" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : step.isSpecial ? (
                  '✦'
                ) : (
                  step.number
                )}
              </div>
              {step.label}
            </div>

            {!isLast && (
              <div
                style={{
                  width: '32px',
                  height: '1px',
                  background: '#E8E4DF',
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
