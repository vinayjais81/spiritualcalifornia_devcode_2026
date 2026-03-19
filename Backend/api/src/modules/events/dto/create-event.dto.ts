import { IsString, IsEnum, IsDateString, IsNumber, IsOptional, IsPositive, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '@prisma/client';

export class CreateEventDto {
  @ApiProperty({ example: 'New Moon Meditation Circle' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({ example: '2026-04-01T18:00:00.000Z' })
  @IsDateString()
  startTime: string;

  /** Defaults to startTime + 2 hours if omitted */
  @ApiPropertyOptional({ example: '2026-04-01T20:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ example: 45 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ticketPrice?: number;

  /** Max attendees — null means unlimited */
  @ApiPropertyOptional({ example: 30 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  ticketCapacity?: number;

  /** Required for IN_PERSON events */
  @ApiPropertyOptional({ example: 'The Ojai Foundation, 9739 Santa Paula Rd, Ojai, CA 93023' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  timezone?: string;
}
