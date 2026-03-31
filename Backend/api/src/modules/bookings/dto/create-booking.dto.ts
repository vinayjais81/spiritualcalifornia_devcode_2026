import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'Service ID to book' })
  @IsString()
  serviceId: string;

  @ApiProperty({ description: 'Service slot ID (selected time)' })
  @IsString()
  slotId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
