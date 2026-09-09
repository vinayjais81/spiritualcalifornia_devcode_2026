import { useAuthStore } from '@/store/auth.store';

/**
 * Client-side mirror of the server's self-dealing rule.
 *
 * The server is the authority — `common/self-dealing.ts` refuses these
 * purchases outright, and nothing here can be trusted to hold. This exists only
 * to move the refusal earlier. Without it a practitioner can browse their own
 * listing, fill in a booking form, enter card details and be told no at submit,
 * which is precisely the failure the original assessment called out in the
 * cart: "a half-built version of this request, failing at the worst possible
 * moment."
 *
 * See docs/practitioners-as-buyers.md.
 */

/** The copy shown wherever a practitioner meets their own listing. */
export const SELF_DEALING_NOTICE =
  'This is your own listing. Practitioner accounts can buy from other practitioners, but not from themselves.';

/**
 * True when the signed-in user owns the practitioner profile given.
 *
 * Accepts the GuideProfile id or its slug, because the public pages have
 * different halves of that pair to hand — listing cards carry the id, the
 * booking routes are keyed by slug.
 *
 * Returns false when signed out, and false when the identifier is missing. A
 * missing identifier must not read as "mine": that would hide the buy button
 * from everyone on a page where the data failed to load. The server still
 * refuses the real thing, so guessing wrong here is a cosmetic bug, whereas
 * guessing wrong the other way blocks legitimate sales.
 */
export function isOwnGuide(
  user: { guideProfileId?: string; guideSlug?: string } | null | undefined,
  guide: { id?: string | null; slug?: string | null } | null | undefined,
): boolean {
  if (!user?.guideProfileId || !guide) return false;
  if (guide.id && user.guideProfileId === guide.id) return true;
  if (guide.slug && user.guideSlug && user.guideSlug === guide.slug) return true;
  return false;
}

/** Hook form, for components that already read the auth store. */
export function useIsOwnGuide(guide: { id?: string | null; slug?: string | null } | null | undefined): boolean {
  const user = useAuthStore((s) => s.user);
  return isOwnGuide(user, guide);
}
