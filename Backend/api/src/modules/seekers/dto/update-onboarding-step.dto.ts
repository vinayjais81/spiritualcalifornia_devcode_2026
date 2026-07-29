import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsBoolean, IsOptional, Min, Max } from 'class-validator';

/**
 * Body for `PATCH /seekers/onboarding/step`. The sibling of the
 * UpdateSeekerProfileDto fix — same inline-type-literal bypass, so `step`
 * was written to `SeekerProfile.onboardingStep` unvalidated (a string, a
 * float, or a negative all landed in the column and then drove which wizard
 * screen the user resumed on).
 *
 * The seeker wizard has 5 steps; the cap allows headroom without accepting
 * arbitrary integers.
 */
export class UpdateOnboardingStepDto {
  @ApiProperty({ minimum: 1, maximum: 10, example: 3 })
  @IsInt({ message: 'Step must be a whole number.' })
  @Min(1, { message: 'Step must be at least 1.' })
  @Max(10, { message: 'Step must be 10 or less.' })
  step!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
