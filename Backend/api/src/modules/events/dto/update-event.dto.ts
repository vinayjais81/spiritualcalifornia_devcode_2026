import { IsString, IsEnum, IsDateString, IsNumber, IsOptional, IsBoolean, IsPositive, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '@prisma/client';

export class UpdateEventDto {
  @ApiPropertyOptional({ example: 'Updated Event Title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  /**
   * Ticket price for the event's General Admission tier. Omit to leave the
   * price untouched; 0 makes the event free.
   *
   * The price lives on EventTicketTier, not Event, which is why this field
   * had been left out of the update DTO entirely — so the dashboard's Edit
   * form had no way to change a price after creation, and `whitelist` +
   * `forbidNonWhitelisted` turned any attempt into a 400.
   */
  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ticketPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCancelled?: boolean;
}
