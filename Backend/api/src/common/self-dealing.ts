import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';

/**
 * Self-dealing guard — a practitioner must not transact against their own
 * catalogue.
 *
 * Until now nothing enforced this, because nothing needed to: SEEKER and GUIDE
 * were mutually exclusive (see guides.service.ts), so a practitioner could
 * never hold the buyer role that every purchase path requires. The role mutex
 * was doing this job by accident.
 *
 * Granting practitioners buyer access (see docs/practitioners-as-buyers.md)
 * removes that accident, and three things open at once:
 *
 *   1. Fake verified reviews. A review requires a completed purchase, so
 *      buying your own listing makes you eligible to review yourself — with a
 *      "verified purchase" badge on it. That is a direct attack on the
 *      trust-through-verification promise the marketplace is built on.
 *   2. Inflated sales figures and manufactured social proof on the profile.
 *   3. A payment loop: a purchase on a stolen card settles the practitioner's
 *      share into their own connected payout account while the chargeback
 *      lands on the platform. A well-known card-testing pattern.
 *
 * These guards are therefore deliberately NOT behind the PRACTITIONER_BUYER
 * feature flag. Today they are unreachable — no account holds both roles — so
 * shipping them unconditionally changes nothing for users, and it makes the
 * ordering constraint structural rather than procedural: the block cannot be
 * left switched off on the day the roles are granted.
 *
 * Both helpers compare against GuideProfile.userId, never GuideProfile.id: the
 * buyer identity on a purchase is the User, and the seller identity on a
 * listing is a profile owned by a User. Comparing the two id spaces directly
 * would silently never match.
 */

/** Shown to the practitioner. Says what happened and why, without accusing. */
export const SELF_PURCHASE_MESSAGE =
  'You cannot purchase your own listing. Practitioner accounts can buy from ' +
  'other practitioners, but not from themselves.';

/**
 * Refuse when the buyer is the practitioner selling the thing.
 *
 * `guideUserId` is the User.id behind the offering's GuideProfile. A null or
 * undefined value means the caller could not resolve an owner, which is never
 * a licence to proceed — an unresolvable owner is refused, not waved through.
 *
 * `subject` names the offending item. It matters for the shop, where a cart can
 * mix several practitioners' products and an unqualified refusal leaves the
 * buyer hunting for which line caused it.
 */
export function assertNotOwnListing(
  buyerUserId: string,
  guideUserId: string | null | undefined,
  subject?: string,
): void {
  if (!guideUserId) {
    throw new ForbiddenException(
      'This listing has no resolvable owner and cannot be purchased.',
    );
  }
  if (guideUserId === buyerUserId) {
    throw new ForbiddenException(
      subject ? `${SELF_PURCHASE_MESSAGE} (“${subject}”)` : SELF_PURCHASE_MESSAGE,
    );
  }
}

/**
 * Same check for call sites that hold only a GuideProfile.id.
 *
 * Prefer selecting `guide: { select: { userId: true } }` alongside the offering
 * and calling assertNotOwnListing — this variant costs an extra round trip and
 * exists for the paths where widening the existing query would be invasive.
 */
export async function assertNotOwnGuideProfile(
  prisma: PrismaService,
  buyerUserId: string,
  guideProfileId: string,
): Promise<void> {
  const guide = await prisma.guideProfile.findUnique({
    where: { id: guideProfileId },
    select: { userId: true },
  });
  assertNotOwnListing(buyerUserId, guide?.userId);
}
