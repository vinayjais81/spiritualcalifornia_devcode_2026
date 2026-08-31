import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateSeekerBasicsDto } from './update-seeker-basics.dto';
import { SEEKER_PROFILE_LIMITS } from '../../../common/seeker-profile-limits';

// PATCH /users/seeker/profile is the register wizard's interest-saving route.
// It writes bio/location/interests — the same columns as PATCH /seekers/me —
// but its DTO carried no length caps, so the limits added in 57c2370 only ever
// covered one of the two doors onto those columns. These tests pin the second.
//
// Mirrors the global pipe's options from main.ts.
const validate = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(UpdateSeekerBasicsDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const errorsOn = (body: Record<string, unknown>) =>
  validate(body).map((e) => e.property);

describe('UpdateSeekerBasicsDto', () => {
  it('accepts what the register wizard actually sends', () => {
    expect(validate({ interests: ['Meditation', 'Breathwork'] })).toHaveLength(
      0,
    );
    expect(validate({})).toHaveLength(0);
  });

  describe('bio', () => {
    it(`accepts exactly ${SEEKER_PROFILE_LIMITS.bio} characters`, () => {
      expect(
        validate({ bio: 'a'.repeat(SEEKER_PROFILE_LIMITS.bio) }),
      ).toHaveLength(0);
    });

    it('rejects the ~2,800-character bio from the defect report', () => {
      const errors = validate({ bio: 'a'.repeat(2800) });
      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})).toContain(
        'Bio must be 1000 characters or fewer.',
      );
    });
  });

  describe('interests', () => {
    it('accepts unicode entries within the per-item cap', () => {
      // Cyrillic + emoji + odd whitespace is legal input, not a defect — the
      // report flagged it only because nothing was bounded at the time.
      expect(
        validate({ interests: ['Медитация', 'Йога 🧘', 'Sound Healing'] }),
      ).toHaveLength(0);
    });

    it(`rejects more than ${SEEKER_PROFILE_LIMITS.interestCount} entries`, () => {
      const { interestCount } = SEEKER_PROFILE_LIMITS;
      expect(
        validate({ interests: Array(interestCount).fill('Yoga') }),
      ).toHaveLength(0);
      expect(
        errorsOn({ interests: Array(interestCount + 1).fill('Yoga') }),
      ).toEqual(['interests']);
    });

    it('rejects an over-long custom interest', () => {
      // The "+ Add your own" input is free text; this is the value it produces.
      const { interestLength } = SEEKER_PROFILE_LIMITS;
      expect(
        validate({ interests: ['x'.repeat(interestLength)] }),
      ).toHaveLength(0);
      expect(errorsOn({ interests: ['x'.repeat(interestLength + 1)] })).toEqual(
        ['interests'],
      );
    });

    it('counts code points, keeping the server the more permissive side', () => {
      // Same asymmetry as UpdateSeekerProfileDto: the browser's maxLength
      // counts UTF-16 units, so anything the input allows must pass here.
      expect(
        validate({
          interests: ['🧘'.repeat(SEEKER_PROFILE_LIMITS.interestLength)],
        }),
      ).toHaveLength(0);
    });

    it('rejects non-string entries', () => {
      expect(errorsOn({ interests: [{ nested: 'object' }] })).toEqual([
        'interests',
      ]);
    });
  });

  it('bounds location', () => {
    expect(
      errorsOn({ location: 'a'.repeat(SEEKER_PROFILE_LIMITS.location + 1) }),
    ).toEqual(['location']);
  });

  // The service maps exactly three columns; this endpoint must not become a
  // back door onto the rest of the profile or onto the onboarding flags.
  it('rejects fields that belong to PATCH /seekers/me', () => {
    expect(errorsOn({ journeyText: 'x' })).toEqual(['journeyText']);
    expect(errorsOn({ practices: ['Reiki'] })).toEqual(['practices']);
    expect(errorsOn({ onboardingCompleted: true })).toEqual([
      'onboardingCompleted',
    ]);
    expect(errorsOn({ userId: 'someone-elses-id' })).toEqual(['userId']);
  });
});
