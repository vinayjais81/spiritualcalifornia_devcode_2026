import { detectBot, MIN_HUMAN_FILL_MS } from './bot-signals';

// Three signals with three different confidences, and therefore three different
// consequences. The asymmetry is the design, so these tests mostly exist to stop
// it being "tidied up" into one uniform rule later:
//
//   honeypot filled  -> drop    (certain; discard silently, answer as success)
//   fields absent    -> reject  (ambiguous; visible "reload" error)
//   too fast         -> flag    (weak; keep it, just skip the courtesy email)

describe('detectBot', () => {
  const fromForm = { honeypot: '', elapsedMs: 9000 };

  it('accepts an ordinary submission', () => {
    expect(detectBot(fromForm)).toEqual({ action: 'accept' });
  });

  // ── Honeypot: certain ─────────────────────────────────────────────────────

  it('drops a filled honeypot', () => {
    const v = detectBot({ ...fromForm, honeypot: 'http://spam.example' });
    expect(v.action).toBe('drop');
    expect(v.reason).toMatch(/honeypot/i);
  });

  it('treats whitespace as untouched', () => {
    // A proxy trimming an empty field must not look like a bot.
    expect(detectBot({ ...fromForm, honeypot: '   ' }).action).toBe('accept');
  });

  it('drops before it considers timing', () => {
    expect(detectBot({ honeypot: 'x', elapsedMs: 5 }).action).toBe('drop');
  });

  // ── Missing proof of form render: the gap that let a bot through ───────────
  //
  // On 2026-09-02 a registration was blocked by the honeypot at 14:36:53 and
  // succeeded four seconds later with the same address — retried straight at
  // the API, where an omitted field reads as empty and empty passes.

  it('rejects a submission with no honeypot field at all', () => {
    const v = detectBot({ elapsedMs: 9000 });
    expect(v.action).toBe('reject');
    expect(v.reason).toMatch(/anti-spam field missing/i);
  });

  it('rejects a submission with no timing field', () => {
    const v = detectBot({ honeypot: '' });
    expect(v.action).toBe('reject');
    expect(v.reason).toMatch(/timing missing/i);
  });

  it('rejects a bare direct POST carrying neither field', () => {
    expect(detectBot({}).action).toBe('reject');
  });

  it('rejects null, which is what a sloppy client sends for "absent"', () => {
    expect(detectBot({ honeypot: null, elapsedMs: 9000 }).action).toBe('reject');
    // `Number(null)` is 0 — finite, non-negative, under the threshold — so
    // coercing here would have read as an instant submission rather than a
    // missing one.
    expect(detectBot({ honeypot: '', elapsedMs: null }).action).toBe('reject');
  });

  it('rejects a wrongly-typed field instead of throwing', () => {
    // Caller-supplied JSON: `{contactReference: {}}` must not 500.
    expect(detectBot({ honeypot: {}, elapsedMs: 9000 }).action).toBe('reject');
    expect(detectBot({ honeypot: 42, elapsedMs: 9000 }).action).toBe('reject');
    expect(detectBot({ honeypot: '', elapsedMs: 'soon' }).action).toBe('reject');
    expect(detectBot({ honeypot: '', elapsedMs: NaN }).action).toBe('reject');
    expect(detectBot({ honeypot: '', elapsedMs: -5 }).action).toBe('reject');
  });

  // ── Timing: weak, so it never discards ────────────────────────────────────

  it('flags an instant submission but keeps it', () => {
    const v = detectBot({ honeypot: '', elapsedMs: 120 });
    expect(v.action).toBe('flag');
    expect(v.reason).toMatch(/120ms/);
  });

  it('accepts exactly at the threshold and flags just under', () => {
    expect(detectBot({ honeypot: '', elapsedMs: MIN_HUMAN_FILL_MS }).action).toBe('accept');
    expect(detectBot({ honeypot: '', elapsedMs: MIN_HUMAN_FILL_MS - 1 }).action).toBe('flag');
  });

  it('treats a real zero as instant, not as missing', () => {
    // The distinction the `typeof` guard exists to preserve.
    expect(detectBot({ honeypot: '', elapsedMs: 0 }).action).toBe('flag');
  });
});
