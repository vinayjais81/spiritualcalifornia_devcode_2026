import {
  IsString, IsInt, Min, IsOptional, IsEmail, IsDateString,
  IsBoolean, IsArray, ValidateNested, IsNumber, ArrayMinSize, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TravelerDto {
  @ApiProperty({ description: 'Whether this is the primary traveler / booking contact' })
  @IsBoolean()
  isPrimary!: boolean;

  @ApiProperty({ description: 'First name as on passport' })
  @IsString()
  firstName!: string;

  @ApiProperty({ description: 'Last name as on passport' })
  @IsString()
  lastName!: string;

  @ApiProperty() @IsDateString() dateOfBirth!: string;
  @ApiProperty() @IsString() nationality!: string;
  @ApiProperty() @IsString() passportNumber!: string;
  @ApiProperty() @IsDateString() passportExpiry!: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}

export class BookTourDto {
  @ApiProperty() @IsString() tourId!: string;

  @ApiProperty({ description: 'The specific bookable departure' })
  @IsString()
  departureId!: string;

  @ApiProperty() @IsString() roomTypeId!: string;
  @ApiProperty() @IsInt() @Min(1) travelers!: number;

  @ApiProperty({ type: [TravelerDto], description: 'Per-person manifest — must equal `travelers` length' })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TravelerDto)
  travelersDetails!: TravelerDto[];

  // Booking-level health & preferences (design Step 3)
  @ApiPropertyOptional({ description: 'e.g. vegetarian | vegan | gluten-free | other | none' })
  @IsOptional() @IsString()
  dietaryRequirements?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() dietaryNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() healthConditions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() intentions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specialRequests?: string;

  @ApiProperty({ description: 'The deposit amount the user picked in checkout (USD)' })
  @IsNumber() @Min(0)
  chosenDepositAmount!: number;

  @ApiPropertyOptional({ description: 'Payment method — only STRIPE_CARD supported in v1' })
  @IsOptional() @IsIn(['STRIPE_CARD', 'BANK_TRANSFER', 'CRYPTO'])
  paymentMethod?: string;
}

export class PayBalanceDto {
  @ApiPropertyOptional({ description: 'Optional partial balance amount; defaults to full remaining balance' })
  @IsOptional() @IsNumber() @Min(0)
  amount?: number;
}

export class CancelBookingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
