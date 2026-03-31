import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  WizardStep,
  Step0Data,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  Step6Data,
  Category,
  OnboardingStatus,
} from '@/types/onboarding';

interface OnboardingState {
  step: WizardStep;
  categories: Category[];
  status: OnboardingStatus | null;

  step0: Step0Data;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  step5: Step5Data;
  step6: Step6Data;

  isLoading: boolean;
  error: string | null;

  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setCategories: (categories: Category[]) => void;
  setStatus: (status: OnboardingStatus) => void;
  setStep0: (data: Partial<Step0Data>) => void;
  setStep1: (data: Partial<Step1Data>) => void;
  setStep2: (data: Partial<Step2Data>) => void;
  setStep3: (data: Partial<Step3Data>) => void;
  setStep4: (data: Partial<Step4Data>) => void;
  setStep5: (data: Partial<Step5Data>) => void;
  setStep6: (data: Partial<Step6Data>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultStep0: Step0Data = { firstName: '', lastName: '', email: '', password: '' };

const defaultStep1: Step1Data = {
  displayName: '',
  firstName: '',
  lastName: '',
  tagline: '',
  bio: '',
  phone: '',
  location: '',
  timezone: 'America/Los_Angeles',
  websiteUrl: '',
  languages: ['English'],
  avatarS3Key: '',
  avatarPreviewUrl: '',
};

const defaultStep2: Step2Data = {
  selections: [],
  modalities: [],
  issuesHelped: [],
};

const defaultStep3: Step3Data = {
  credentials: [],
  teacherName: '',
  teacherContact: '',
  authorization: '',
};

const defaultStep4: Step4Data = { skipped: false };

const defaultStep5: Step5Data = {
  calendarType: 'Calendly',
  calendarLink: '',
  pricing: {
    session60Price: '',
    session60Type: 'Online',
    session90Price: '',
    session90Type: 'Online',
    packagePrice: '',
    groupPrice: '',
  },
};

const defaultStep6: Step6Data = {
  skipped: false,
  digitalProducts: [],
  physicalProducts: [],
  events: [],
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      step: 0,
      categories: [],
      status: null,
      step0: defaultStep0,
      step1: defaultStep1,
      step2: defaultStep2,
      step3: defaultStep3,
      step4: defaultStep4,
      step5: defaultStep5,
      step6: defaultStep6,
      isLoading: false,
      error: null,

      setStep: (step) => set({ step }),
      nextStep: () => set((s) => ({ step: Math.min(7, s.step + 1) as WizardStep })),
      prevStep: () => set((s) => ({ step: Math.max(1, s.step - 1) as WizardStep })),
      setCategories: (categories) => set({ categories }),
      setStatus: (status) => set({ status }),
      setStep0: (data) => set((s) => ({ step0: { ...s.step0, ...data } })),
      setStep1: (data) => set((s) => ({ step1: { ...s.step1, ...data } })),
      setStep2: (data) => set((s) => ({ step2: { ...s.step2, ...data } })),
      setStep3: (data) => set((s) => ({ step3: { ...s.step3, ...data } })),
      setStep4: (data) => set((s) => ({ step4: { ...s.step4, ...data } })),
      setStep5: (data) => set((s) => ({ step5: { ...s.step5, ...data } })),
      setStep6: (data) => set((s) => ({ step6: { ...s.step6, ...data } })),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      reset: () =>
        set({
          step: 0,
          status: null,
          step0: defaultStep0,
          step1: defaultStep1,
          step2: defaultStep2,
          step3: defaultStep3,
          step4: defaultStep4,
          step5: defaultStep5,
          step6: defaultStep6,
          error: null,
        }),
    }),
    {
      name: 'sc-onboarding-v3',
      version: 1,
      migrate: (persisted: any) => {
        // Ensure Step6 arrays exist for stores migrated from v2
        if (persisted?.step6 && !Array.isArray(persisted.step6.digitalProducts)) {
          persisted.step6.digitalProducts = [];
          persisted.step6.physicalProducts = [];
          persisted.step6.events = [];
        }
        return persisted;
      },
      partialize: (state) => ({
        step: state.step,
        status: state.status,
        step0: state.step0,
        step1: state.step1,
        step2: state.step2,
        step3: state.step3,
        step4: state.step4,
        step5: state.step5,
        step6: state.step6,
      }),
    },
  ),
);
