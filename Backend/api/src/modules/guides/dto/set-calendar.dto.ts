import { IsString, IsOptional, MaxLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SetCalendarDto {
  @ApiPropertyOptional({ example: 'Calendly', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.calendarType !== null)
  @IsString()
  @MaxLength(50)
  calendarType?: string | null;

  @ApiPropertyOptional({ example: 'calendly.com/maya-rosenberg', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.calendarLink !== null)
  @IsString()
  @MaxLength(200)
  calendarLink?: string | null;

  @ApiPropertyOptional({ description: 'JSON-encoded session pricing object' })
  @IsOptional()
  @ValidateIf((o) => o.sessionPricingJson !== null)
  @IsString()
  sessionPricingJson?: string | null;
}
