// ─── Category types (from GET /guides/categories) ────────────────────────────

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  isCustom: boolean;
  isApproved: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
  subcategories: Subcategory[];
}

// ─── Onboarding step data shapes ─────────────────────────────────────────────

export interface Step0Data {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// Step 1: Profile
export interface Step1Data {
  displayName: string;
  firstName: string;
  lastName: string;
  tagline: string;
  bio: string;
  phone: string;
  location: string;
  timezone: string;
  websiteUrl: string;
  languages: string[];        // e.g. ['English', 'Spanish']
  avatarS3Key: string;
  avatarPreviewUrl: string;   // local blob URL for preview
}

// Step 2: Services (categories + modalities + issues)
export interface CategorySelection {
  categoryId: string;
  subcategoryIds: string[];
  customSubcategoryNames: string[];
}

export interface Step2Data {
  selections: CategorySelection[];
  modalities: string[];
  issuesHelped: string[];
}

// Step 3: Credentials
export interface CredentialEntry {
  localId: string;
  title: string;
  institution: string;
  issuedYear: string;
  documentS3Key: string;
  documentFileName: string;
  persisted: boolean;
  persistedId?: string;
  // Teacher attestation fields (not sent individually — bundled into notes)
  teacherName?: string;
  teacherContact?: string;
  authorization?: string;
}

export interface Step3Data {
  credentials: CredentialEntry[];
  teacherName: string;
  teacherContact: string;
  authorization: string;
}

// Step 4: Identity verification
export interface Step4Data {
  skipped: boolean;
  inquiryId?: string;
}

// Step 5: Calendar & Pricing
export interface SessionPricing {
  session60Price: string;
  session60Type: string;
  session90Price: string;
  session90Type: string;
  packagePrice: string;
  groupPrice: string;
}

export interface Step5Data {
  calendarType: string;
  calendarLink: string;
  pricing: SessionPricing;
}

// Step 6: Products & Events (all optional)

export interface DigitalProduct {
  localId: string;
  name: string;
  price: string;
  fileS3Key: string;
  fileName: string;
  persistedId?: string;
}

export interface PhysicalProduct {
  localId: string;
  name: string;
  price: string;
  description: string;
  imageS3Keys: string[];
  imagePreviews: string[];
  persistedId?: string;
}

export interface DraftEvent {
  localId: string;
  name: string;
  type: 'VIRTUAL' | 'IN_PERSON';
  startDateTime: string;
  ticketPrice: string;
  ticketCapacity: string;
  location: string;
  description: string;
  persistedId?: string;
}

export interface Step6Data {
  skipped: boolean;
  digitalProducts: DigitalProduct[];
  physicalProducts: PhysicalProduct[];
  events: DraftEvent[];
}

// ─── Overall wizard state ──────────────────────────────────────────────────

export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OnboardingStatus {
  guideId: string | null;
  verificationStatus: string;
  completedSteps: number[];
  currentStep: WizardStep;
}
