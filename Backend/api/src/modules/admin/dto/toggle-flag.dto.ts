import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Bodies for the admin single-boolean toggle routes, all previously inline
 * type literals and therefore unvalidated.
 *
 * The failure mode here is quiet rather than dramatic: with no @IsBoolean, a
 * body of `{ isActive: "false" }` (a truthy string) or `{}` (undefined) went
 * straight to Prisma. `undefined` makes Prisma *skip the column*, so the
 * request 200s having changed nothing — the admin sees a success toast and a
 * row that didn't move.
 *
 * NOTE: the global ValidationPipe runs with `enableImplicitConversion: true`,
 * which coerces the strings "true"/"false" to real booleans before @IsBoolean
 * sees them. That is intentional and matches the rest of the API; other
 * truthy junk ("yes", 1, null) is still rejected.
 */

export class SetActiveDto {
  @ApiProperty()
  @IsBoolean({ message: 'isActive must be true or false.' })
  isActive!: boolean;
}

export class SetPublishedDto {
  @ApiProperty()
  @IsBoolean({ message: 'isPublished must be true or false.' })
  isPublished!: boolean;
}

export class SetFeaturedDto {
  @ApiProperty()
  @IsBoolean({ message: 'isFeatured must be true or false.' })
  isFeatured!: boolean;
}
