import { IsInt, Min, Max, IsString, IsBoolean, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AvailabilitySlotDto {
  @ApiProperty({ description: '0=Sun, 1=Mon ... 6=Sat' })
  @IsInt() @Min(0) @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Min(0)
  bufferMin?: number;
}

export class SetAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}
