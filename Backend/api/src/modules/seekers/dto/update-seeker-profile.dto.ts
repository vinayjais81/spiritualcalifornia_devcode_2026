import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
 * See docs/seeker-profile-field-limits.md.
 */
export class UpdateSeekerProfileDto {
  @ApiPropertyOptional({
    maxLength: 1000,
    example: "I've been practising meditation for a few years…",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Bio must be 1000 characters or fewer.' })
  bio?: string;

  @ApiPropertyOptional({ maxLength: 100, example: 'San Francisco, CA' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Location must be 100 characters or fewer.' })
  location?: string;

  @ApiPropertyOptional({ maxLength: 60, example: 'America/Los_Angeles' })
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Timezone must be 60 characters or fewer.' })
  timezone?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Meditation', 'Breathwork'],
    description: 'Up to 20 interests, 40 characters each.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Add at most 20 interests.' })
  @IsString({ each: true })
  @MaxLength(40, {
    each: true,
    message: 'Each interest must be 40 characters or fewer.',
  })
  interests?: string[];

  // Free-text rather than an enum on purpose — see the schema comment on
  // SeekerProfile.experienceLevel. Bounded, but not restricted to a list.
  @ApiPropertyOptional({ maxLength: 40, example: 'explorer' })
  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'Experience level must be 40 characters or fewer.' })
  experienceLevel?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['Meditation', 'Yoga'],
    description: 'Up to 30 practices, 60 characters each.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: 'Select at most 30 practices.' })
  @IsString({ each: true })
  @MaxLength(60, {
    each: true,
    message: 'Each practice must be 60 characters or fewer.',
  })
  practices?: string[];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'What brings you here must be 1000 characters or fewer.',
  })
  journeyText?: string | null;
}
