import { detectBot, MIN_HUMAN_FILL_MS } from './bot-signals';

// The honeypot is a HARD signal — a filled hidden field drops the submission.
// Timing is a SOFT one — it never discards anything, because a real person can
// paste a prepared message and an old cached page may not send the field at all.
// These tests exist mainly to keep that asymmetry from being "tidied up" later.

describe('detectBot', () => {
  const human = { honeypot: '', elapsedMs: 9000 };

  it('passes an ordinary submission', () => {
    expect(detectBot(human)).toEqual({ bot: false, suspicious: false });
  });

  // ── Honeypot: hard ────────────────────────────────────────────────────────

  it('catches a filled honeypot', () => {
    const v = detectBot({ ...human, honeypot: 'http://spam.example' });
    expect(v.bot).toBe(true);
    expect(v.reason).toMatch(/honeypot/i);
  });

  it('treats whitespace as empty', () => {
    // A browser or a proxy trimming an untouched field must not look like a bot.
    expect(detectBot({ ...human, honeypot: '   ' }).bot).toBe(false);
  });

  it('ignores a non-string honeypot instead of throwing', () => {
    // The field is caller-supplied JSON; `{contactReference: {}}` must not 500.
    expect(detectBot({ ...human, honeypot: { nested: true } }).bot).toBe(false);
    expect(detectBot({ ...human, honeypot: 42 }).bot).toBe(false);
  });

  // ── Timing: soft ──────────────────────────────────────────────────────────

  it('flags an instant submission without dropping it', () => {
    const v = detectBot({ honeypot: '', elapsedMs: 120 });
    expect(v.bot).toBe(false);        // never discarded
    expect(v.suspicious).toBe(true);  // but no auto-reply
    expect(v.reason).toMatch(/120ms/);
  });

  it('accepts a submission exactly at the threshold', () => {
    expect(detectBot({ honeypot: '', elapsedMs: MIN_HUMAN_FILL_MS }).suspicious).toBe(false);
  });

  it('does NOT flag a missing timer', () => {
    // A page cached from before this shipped sends no elapsedMs. Treating that
    // as suspicious would have silently stopped auto-replies for real people.
    expect(detectBot({ honeypot: '' })).toEqual({ bot: false, suspicious: false });
    expect(detectBot({ honeypot: '', elapsedMs: undefined }).suspicious).toBe(false);
  });

  it('does NOT flag a garbage or negative timer', () => {
    // Only a value that is genuinely, measurably too fast counts.
    for (const bad of ['abc', NaN, -500, null, {}]) {
      expect(detectBot({ honeypot: '', elapsedMs: bad }).suspicious).toBe(false);
    }
  });

  it('reports the honeypot first when both signals fire', () => {
    const v = detectBot({ honeypot: 'x', elapsedMs: 5 });
    expect(v.bot).toBe(true);
    expect(v.reason).toMatch(/honeypot/i);
  });
});
