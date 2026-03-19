import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SetCalendarDto {
  @ApiPropertyOptional({ example: 'Calendly' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  calendarType?: string;

  @ApiPropertyOptional({ example: 'calendly.com/maya-rosenberg' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  calendarLink?: string;

  @ApiPropertyOptional({ description: 'JSON-encoded session pricing object' })
  @IsOptional()
  @IsString()
  sessionPricingJson?: string;
}
