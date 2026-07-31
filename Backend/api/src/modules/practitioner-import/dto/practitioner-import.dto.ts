import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProspectStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Every field here is validated because an inline literal or bare `any` on
 * `@Body()` silently skips ValidationPipe entirely — see
 * docs/inline-body-unvalidated.md.
 */

export class UploadImportDto {
  @ApiPropertyOptional({ example: 'Bay Area list, Jul 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceLabel?: string;
}

export class ListRowsQueryDto {
  @ApiPropertyOptional({ enum: ProspectStatus })
  @IsOptional()
  @IsEnum(ProspectStatus)
  status?: ProspectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sheet?: string;

  @ApiPropertyOptional({ description: 'Search name, email or city' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class UpdateProspectDto {
  /** The inline "add email" that rescues a skipped row. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  /** "Contacted via Psychology Today, 12 Aug" — stops duplicated chasing. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  workedNote?: string;
}

export class ExcludeProspectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
