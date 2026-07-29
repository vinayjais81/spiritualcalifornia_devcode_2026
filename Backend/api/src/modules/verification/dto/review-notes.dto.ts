import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for the admin approve/reject verification routes. Was an inline
 * `@Body() body: { notes?: string }` on both, so ValidationPipe skipped them
 * and the reviewer note went to the database unbounded.
 *
 * Mirrors the 1000-char cap already on RejectGuideDto in the admin module.
 */
export class ReviewNotesDto {
  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Internal reviewer note recorded against the decision.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Notes must be 1000 characters or fewer.' })
  notes?: string;
}
