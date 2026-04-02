import { IsString, IsOptional, IsNumber, IsEmail, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceBookingDto {
  @ApiProperty({ description: 'Service ID to book' })
  @IsString()
  serviceId: string;

  @ApiProperty({ description: 'Selected start time (ISO string from Calendly)' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'Selected end time (ISO string from Calendly)' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional({ description: 'Calendly event URI (for reference/cancellation)' })
  @IsOptional()
  @IsString()
  calendlyEventUri?: string;

  @ApiPropertyOptional({ description: 'Calendly invitee URI' })
  @IsOptional()
  @IsString()
  calendlyInviteeUri?: string;

  // Seeker contact details
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  // Session context
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sessionNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  experienceLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  healthConditions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referralSource?: string;
}
