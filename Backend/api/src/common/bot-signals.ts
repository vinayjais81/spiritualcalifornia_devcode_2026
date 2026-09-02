/**
 * Bot detection for public, unauthenticated forms.
 *
 * Written after the 2026-09-02 contact-form abuse, where a distributed bot
 * posted 430 submissions in 48 hours. Rate limiting could not touch it: the
 * per-IP throttle was verified enforcing (5 pass, the 6th gets a 429) while
 * submissions carried on at ~19/hour, which is only possible from many
 * addresses. When the source is spread out, the question has to stop being
 * "how often is this IP asking?" and start being "is this a person?".
 *
 * Two signals, deliberately weighted differently.
 */

/** Field name is intentionally bland — see the note on autofill below. */
export const HONEYPOT_FIELD = 'contactReference';

/** Below this, a submission was not typed by a human. */
export const MIN_HUMAN_FILL_MS = 2000;

export type BotVerdict =
  | { bot: false; suspicious: boolean; reason?: string }
  | { bot: true; suspicious: true; reason: string };

/**
 * HONEYPOT — a hard signal.
 *
 * The form renders a field positioned off-screen. A person never sees it, so it
 * always arrives empty; a bot parses the HTML and fills everything it finds.
 * This particular bot posts correct `type` values ("general", "media",
 * "partnership"…), which are only discoverable by reading the real form — so it
 * is reading the DOM and will fill this too.
 *
 * Two details keep the false-positive rate at effectively zero, and both matter:
 *
 *  - The field is hidden by OFF-SCREEN POSITIONING, not `display:none`. Some
 *    bots deliberately skip `display:none` inputs precisely because they know
 *    the trick.
 *  - The name is `contactReference`, not `website`/`address`/`company`. Password
 *    managers and browser autofill match on recognisable names and would
 *    cheerfully fill a hidden `website` field, turning a real person into a
 *    false positive. `autocomplete="off"` and `tabIndex={-1}` on the input close
 *    the rest of that gap.
 *
 * TIMING — a soft signal, and it is soft on purpose.
 *
 * Scripts post instantly; people take seconds to type. But a real person can
 * paste a prepared message and submit fast, and an old cached page may not send
 * the field at all. Blocking on that would silently discard genuine messages, so
 * timing only ever downgrades a submission to "suspicious" — the caller decides
 * what that costs (here: no auto-reply email), and never drops it.
 */
export function detectBot(input: {
  honeypot?: unknown;
  elapsedMs?: unknown;
}): BotVerdict {
  const honeypot = typeof input.honeypot === 'string' ? input.honeypot.trim() : '';
  if (honeypot.length > 0) {
    return { bot: true, suspicious: true, reason: 'honeypot field was filled' };
  }

  // Absent is not suspicious: a cached page predating this change, or a client
  // that never ran the timer, must still be able to reach a human.
  //
  // The `typeof` check is load-bearing and not defensive noise. `Number(null)`
  // is 0 — finite, non-negative, and comfortably under the threshold — so
  // coercing instead would have flagged every submission whose JSON carried
  // `"elapsedMs": null` as an instant one, which is a shape a client can send
  // by accident. A real numeric 0 still counts as instant, as it should.
  const elapsed = input.elapsedMs;
  if (typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_HUMAN_FILL_MS) {
    return {
      bot: false,
      suspicious: true,
      reason: `submitted in ${Math.round(elapsed)}ms (under ${MIN_HUMAN_FILL_MS}ms)`,
    };
  }

  return { bot: false, suspicious: false };
}
