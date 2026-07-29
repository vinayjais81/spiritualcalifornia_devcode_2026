import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Bodies for the admin review-moderation toggles. Both routes used
 * `@Body('flag') flag: boolean` / `@Body('approved') approved: boolean`.
 *
 * ValidationPipe skips primitive metatypes as surely as it skips inline type
 * literals, so these were unvalidated too: an omitted key arrived as
 * `undefined`, which Prisma treats as "don't touch this column" — the request
 * succeeded without moderating anything.
 */

export class FlagReviewDto {
  @ApiProperty()
  @IsBoolean({ message: 'flag must be true or false.' })
  flag!: boolean;
}

export class ModerateReviewDto {
  @ApiProperty()
  @IsBoolean({ message: 'approved must be true or false.' })
  approved!: boolean;
}
