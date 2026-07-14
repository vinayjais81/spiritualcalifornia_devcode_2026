import { Prisma } from '@prisma/client';

/**
 * The canonical gate for a guide to be publicly visible.
 *
 * A guide's profile — AND every offering they own (services, events, tours,
 * tickets, products) — is only exposed on public surfaces when ALL THREE hold:
 *   - isVerified    → the verification pipeline (identity + credential) passed.
 *   - isPublished   → the admin approved the guide (and has not un-published).
 *   - user.isActive → the account has not been deactivated by an admin.
 *
 * Spread this into any public Prisma `where` under the `guide` relation so the
 * gate can never drift between offering types again. Previously each offering
 * endpoint checked a different subset (some only `user.isActive`), which let an
 * unverified / unpublished guide's tours and products stay publicly reachable
 * even while their profile 404'd.
 *
 * @example
 *   where: { isPublished: true, guide: PUBLIC_GUIDE_WHERE }
 */
export const PUBLIC_GUIDE_WHERE = {
  isVerified: true,
  isPublished: true,
  user: { isActive: true },
} satisfies Prisma.GuideProfileWhereInput;
