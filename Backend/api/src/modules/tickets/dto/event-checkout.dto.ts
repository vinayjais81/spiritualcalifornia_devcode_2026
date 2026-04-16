import {
  IsString, IsInt, Min, Max, IsArray, ValidateNested,
  IsOptional, IsEmail, ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AttendeeDto {
  @ApiProperty() @IsString() firstName!: string;
  @ApiProperty() @IsString() lastName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dietaryNeeds?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accessibilityNeeds?: string;
}

export class EventCheckoutDto {
  @ApiProperty({ description: 'The event ID' })
  @IsString()
  eventId!: string;

  @ApiProperty({ description: 'The ticket tier ID' })
  @IsString()
  tierId!: string;

  @ApiProperty({ description: 'Number of tickets (must match attendees length)' })
  @IsInt() @Min(1) @Max(10)
  quantity!: number;

  @ApiProperty({ type: [AttendeeDto], description: 'One entry per ticket' })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AttendeeDto)
  attendees!: AttendeeDto[];
}
