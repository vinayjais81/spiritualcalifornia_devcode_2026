import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateSeekerProfileDto } from './update-seeker-profile.dto';

// Cover for the "no character-limit guidance on profile Bio / Interests"
// defect: PATCH /seekers/me declared its body as an inline type literal, so
// Nest's ValidationPipe skipped it entirely and a ~2,800-character Bio (and
// unicode/emoji Interests of any length) saved silently.
//
// Mirrors the global pipe's options from main.ts.
const validate = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(UpdateSeekerProfileDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const errorsOn = (body: Record<string, unknown>) =>
  validate(body).map((e) => e.property);

describe('UpdateSeekerProfileDto', () => {
  it('accepts a normal profile edit', () => {
    expect(
      validate({
        bio: 'Exploring meditation and breathwork.',
        location: 'San Francisco, CA',
        timezone: 'America/Los_Angeles',
        interests: ['Meditation', 'Yoga'],
        experienceLevel: 'explorer',
        practices: ['Reiki'],
        journeyText: 'Recovering from burnout.',
      }),
    ).toHaveLength(0);
  });

  it('accepts a partial edit — every field is optional', () => {
    expect(validate({ bio: 'Just the bio.' })).toHaveLength(0);
    expect(validate({})).toHaveLength(0);
  });

  it('accepts null for the clearable wizard-deferred fields', () => {
    // The dashboard sends null (not undefined) to clear these.
    expect(validate({ experienceLevel: null, journeyText: null })).toHaveLength(0);
  });

  describe('bio', () => {
    it('accepts exactly 1000 characters', () => {
      expect(validate({ bio: 'a'.repeat(1000) })).toHaveLength(0);
    });

    it('rejects 1001 characters', () => {
      expect(errorsOn({ bio: 'a'.repeat(1001) })).toEqual(['bio']);
    });

    it('rejects the ~2,800-character bio from the defect report', () => {
      const errors = validate({ bio: 'a'.repeat(2800) });
      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})).toContain(
        'Bio must be 1000 characters or fewer.',
      );
    });

    it('counts code points, so it never rejects what the form allowed', () => {
      // @MaxLength → validator.js isLength, which is surrogate-pair aware:
      // '🙏' counts as 1 here but as 2 against the browser's maxLength. The
      // server must stay the *more permissive* side of that gap, otherwise a
      // save the counter showed as in-bounds would 400. 1000 emoji is 2000
      // UTF-16 units — far past what the form can produce — and still passes.
      expect(validate({ bio: '🙏'.repeat(1000) })).toHaveLength(0);
      // But code points are still bounded.
      expect(errorsOn({ bio: '🙏'.repeat(1001) })).toEqual(['bio']);
    });
  });

  describe('interests', () => {
    it('accepts unicode entries within the per-item cap', () => {
      expect(validate({ interests: ['Медитация', 'Йога 🧘'] })).toHaveLength(0);
    });

    it('rejects more than 20 entries', () => {
      expect(errorsOn({ interests: Array(21).fill('Yoga') })).toEqual(['interests']);
      expect(validate({ interests: Array(20).fill('Yoga') })).toHaveLength(0);
    });

    it('rejects a single over-long entry', () => {
      expect(errorsOn({ interests: ['Meditation', 'x'.repeat(41)] })).toEqual([
        'interests',
      ]);
    });

    it('rejects non-string entries', () => {
      expect(errorsOn({ interests: [{ nested: 'object' }] })).toEqual(['interests']);
    });
  });

  it('bounds location, timezone, practices and journeyText', () => {
    expect(errorsOn({ location: 'a'.repeat(101) })).toEqual(['location']);
    expect(errorsOn({ timezone: 'a'.repeat(61) })).toEqual(['timezone']);
    expect(errorsOn({ journeyText: 'a'.repeat(1001) })).toEqual(['journeyText']);
    expect(errorsOn({ practices: Array(31).fill('Yoga') })).toEqual(['practices']);
    expect(errorsOn({ practices: ['x'.repeat(61)] })).toEqual(['practices']);
  });

  // The inline-type body also spread straight into prisma.seekerProfile.update,
  // which left these columns writable by the seeker.
  it('rejects unknown / non-editable columns', () => {
    expect(errorsOn({ onboardingCompleted: true })).toEqual(['onboardingCompleted']);
    expect(errorsOn({ onboardingStep: 5 })).toEqual(['onboardingStep']);
    expect(errorsOn({ userId: 'someone-elses-id' })).toEqual(['userId']);
  });
});
