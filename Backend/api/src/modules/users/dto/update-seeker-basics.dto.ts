import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  SEEKER_PROFILE_LIMITS as L,
  SEEKER_PROFILE_MESSAGES as M,
} from '../../../common/seeker-profile-limits';

/**
 * Body of PATCH /users/seeker/profile — the register wizard's "what calls to
 * your curiosity?" step, which saves the interest chips (including the
 * free-text "+ Add your own" one) before the seeker ever reaches a dashboard.
 *
 * This class was declared inline in users.controller.ts under the name
 * `UpdateSeekerProfileDto` — the same name as the real one in the seekers
 * module, but with only @IsString/@IsArray on it and no length caps at all.
 * So while PATCH /seekers/me rejected a 2,800-character bio, this route wrote
 * the identical columns unbounded. The inline-@Body() sweep didn't catch it
 * either: the sweep looked for bodies typed as literals, and this one *was* a
 * class, just an unbounded one.
 *
 * Only three fields, deliberately: this endpoint's service maps exactly
 * interests/location/bio. It is not a second door onto the full profile — use
 * PATCH /seekers/me for that.
 *
 * Caps come from the shared constant so the two endpoints cannot drift again.
 * See docs/seeker-profile-field-limits.md.
 */
export class UpdateSeekerBasicsDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['Meditation', 'Breathwork'],
    description: `Up to ${L.interestCount} interests, ${L.interestLength} characters each.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(L.interestCount, { message: M.interestCount })
  @IsString({ each: true })
  @MaxLength(L.interestLength, { each: true, message: M.interestLength })
  interests?: string[];

  @ApiPropertyOptional({ maxLength: L.location, example: 'San Francisco, CA' })
  @IsOptional()
  @IsString()
  @MaxLength(L.location, { message: M.location })
  location?: string;

  @ApiPropertyOptional({ maxLength: L.bio })
  @IsOptional()
  @IsString()
  @MaxLength(L.bio, { message: M.bio })
  bio?: string;
}
