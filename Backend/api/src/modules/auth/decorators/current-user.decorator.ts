import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface CurrentUserData {
  id: string;
  email: string;
  roles: Role[];
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
  /**
   * The caller's own GuideProfile, when they have one. Present so GET /auth/me
   * returns the same shape the login/register responses do — the frontend
   * rehydrates its session from /auth/me, and a guideProfileId that exists at
   * login but disappears on refresh would make the client-side self-purchase
   * checks pass and fail at random.
   */
  guideProfileId?: string;
  guideSlug?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
