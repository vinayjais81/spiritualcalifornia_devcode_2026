/**
 * Bot detection for public, unauthenticated forms.
 *
 * Written after the 2026-09-02 contact-form abuse, where a distributed bot
 * posted 430 submissions in 48 hours. Rate limiting could not touch it: the
 * per-IP throttle was verified enforcing (5 pass, the 6th gets a 429) while
 * submissions carried on at ~19/hour, which is only possible from many
 * addresses. When the source is spread out, the question has to stop being
 * "how often is this IP asking?" and start being "is this a person?".
 */

/** Field name is intentionally bland — see the note on autofill below. */
export const HONEYPOT_FIELD = 'contactReference';

/** Below this, a submission was not typed by a human. */
export const MIN_HUMAN_FILL_MS = 2000;

export type BotAction =
  /** Normal submission. */
  | 'accept'
  /** Accept and store, but skip any courtesy email to the submitter. */
  | 'flag'
  /** Unambiguous bot: discard silently and answer as though it succeeded. */
  | 'drop'
  /** Did not come from our form at all: tell the caller to reload. */
  | 'reject';

export interface BotVerdict {
  action: BotAction;
  reason?: string;
}

/** Shown to whoever gets `reject`. Written for the human it might hit. */
export const RELOAD_MESSAGE =
  'Your session has expired. Please refresh the page and submit again.';

/**
 * Three checks, each with a different confidence and so a different consequence.
 *
 * 1. HONEYPOT FILLED → `drop`. The form renders a field positioned off-screen,
 *    so a person never sees it and it always arrives empty; a bot parses the
 *    HTML and fills everything. This is as close to certain as the signal gets,
 *    so the submission is discarded and the endpoint answers exactly as it would
 *    on success — an error would tell the bot which field caught it.
 *
 *    Two details keep the false-positive rate at effectively zero, and both
 *    matter. The field is hidden by OFF-SCREEN POSITIONING, not `display:none`,
 *    because some bots skip `display:none` inputs knowing they are usually
 *    traps. And it is named `contactReference`, not `website`/`address`/
 *    `company`, because password managers match on recognisable names and would
 *    cheerfully fill a hidden `website` field, turning a real person into a
 *    false positive.
 *
 * 2. FIELDS ABSENT → `reject`. A honeypot only catches a bot that reads the
 *    form. On 2026-09-02 one was observed being blocked at 14:36:53 and then
 *    succeeding four seconds later with the same address — it had retried
 *    straight against the API, where an omitted field simply reads as empty and
 *    empty passes. So presence is now required: a real submission always carries
 *    both fields, and a direct POST carries neither.
 *
 *    This one gets a visible error rather than a silent drop, because it is the
 *    only verdict that can legitimately hit a person — someone on a browser tab
 *    opened before this shipped. Losing a real message silently is a worse
 *    outcome than a bot learning it must send two more fields.
 *
 * 3. TOO FAST → `flag`. Scripts post instantly; people take seconds to type. But
 *    a real person can paste a prepared message, so this never discards
 *    anything. It only costs the courtesy auto-reply.
 */
export function detectBot(input: {
  honeypot?: unknown;
  elapsedMs?: unknown;
}): BotVerdict {
  const hp = input.honeypot;

  if (typeof hp === 'string') {
    if (hp.trim().length > 0) {
      return { action: 'drop', reason: 'honeypot field was filled' };
    }
  } else {
    // Absent, null, or the wrong type — none of which our form can produce.
    return { action: 'reject', reason: 'anti-spam field missing from submission' };
  }

  // `typeof` is load-bearing, not defensive noise: `Number(null)` is 0, which is
  // finite, non-negative and under the threshold, so coercing would have treated
  // `"elapsedMs": null` as an instant submission. A real numeric 0 still counts
  // as instant, as it should.
  const elapsed = input.elapsedMs;
  if (typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < 0) {
    return { action: 'reject', reason: 'form timing missing from submission' };
  }

  if (elapsed < MIN_HUMAN_FILL_MS) {
    return {
      action: 'flag',
      reason: `submitted in ${Math.round(elapsed)}ms (under ${MIN_HUMAN_FILL_MS}ms)`,
    };
  }

  return { action: 'accept' };
}
