export type Role = 'SEEKER' | 'GUIDE' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  roles: Role[];
  isEmailVerified: boolean;
  /**
   * This account's own practitioner profile, when it has one.
   *
   * Practitioners hold the buyer role too, so screens that used to rule them
   * out by role now have to ask a different question: "is this listing mine?"
   * The server refuses a self-purchase either way — this is what lets us say so
   * before the payment step instead of failing at submit.
   *
   * Undefined for seekers and admins.
   */
  guideProfileId?: string;
  guideSlug?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}
