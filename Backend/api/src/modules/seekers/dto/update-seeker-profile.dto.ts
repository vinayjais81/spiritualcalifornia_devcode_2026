import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  SEEKER_PROFILE_LIMITS as L,
  SEEKER_PROFILE_MESSAGES as M,
} from '../../../common/seeker-profile-limits';

/**
 * Body of PATCH /seekers/me.
 *
 * This used to be an inline `@Body() dto: { bio?: string; ... }` type literal.
 * Nest's global ValidationPipe only validates when the body parameter has a
 * *class* metatype, so an inline type meant the endpoint ran with no
 * validation at all: Bio and Interests accepted unbounded input, and the raw
 * body was spread into `prisma.seekerProfile.update({ data })` — which also
 * left `onboardingCompleted` / `onboardingStep` / `userId` writable by the
 * seeker. Making this a real class restores whitelist + forbidNonWhitelisted.
 *
 * Length units: @MaxLength delegates to validator.js `isLength`, which counts
 * *code points* — an emoji costs 1. The browser's `maxLength` and the dashboard
 * counter both count UTF-16 code units, where the same emoji costs 2. The
 * client is therefore always the stricter of the two, so anything the form
 * accepts the API also accepts; the gap only ever shows up as the server
 * tolerating an astral-heavy value the form already refused to let you type.
 * Don't "fix" this by swapping in a code-unit check — it would start rejecting
 * saves the UI said were fine.
 *
 * The caps themselves live in common/seeker-profile-limits.ts because the
 * register wizard writes three of these same columns through a second endpoint
 * (PATCH /users/seeker/profile). That one was left unbounded when this class
 * was written; sharing the numbers is what keeps the two in step.
 *
 * See docs/seeker-profile-field-limits.md.
 */
export class UpdateSeekerProfileDto {
  @ApiPropertyOptional({
    maxLength: L.bio,
    example: "I've been practising meditation for a few years…",
  })
  @IsOptional()
  @IsString()
  @MaxLength(L.bio, { message: M.bio })
  bio?: string;

  @ApiPropertyOptional({ maxLength: L.location, example: 'San Francisco, CA' })
  @IsOptional()
  @IsString()
  @MaxLength(L.location, { message: M.location })
  location?: string;

  @ApiPropertyOptional({
    maxLength: L.timezone,
    example: 'America/Los_Angeles',
  })
  @IsOptional()
  @IsString()
  @MaxLength(L.timezone, { message: M.timezone })
  timezone?: string;

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

  // Free-text rather than an enum on purpose — see the schema comment on
  // SeekerProfile.experienceLevel. Bounded, but not restricted to a list.
  @ApiPropertyOptional({ maxLength: L.experienceLevel, example: 'explorer' })
  @IsOptional()
  @IsString()
  @MaxLength(L.experienceLevel, { message: M.experienceLevel })
  experienceLevel?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['Meditation', 'Yoga'],
    description: `Up to ${L.practiceCount} practices, ${L.practiceLength} characters each.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(L.practiceCount, { message: M.practiceCount })
  @IsString({ each: true })
  @MaxLength(L.practiceLength, { each: true, message: M.practiceLength })
  practices?: string[];

  @ApiPropertyOptional({ maxLength: L.journeyText })
  @IsOptional()
  @IsString()
  @MaxLength(L.journeyText, { message: M.journeyText })
  journeyText?: string | null;
}
