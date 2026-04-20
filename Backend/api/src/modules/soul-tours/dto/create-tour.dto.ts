import {
  IsString, IsOptional, IsNumber, IsDateString, IsInt, Min, IsArray,
  IsBoolean, MaxLength, ValidateNested, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRoomTypeDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsNumber() @Min(0) pricePerNight!: number;
  @ApiProperty() @IsNumber() @Min(0) totalPrice!: number;
  @ApiProperty() @IsInt() @Min(1) capacity!: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];
}

export class CreateDepartureDto {
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiProperty() @IsInt() @Min(1) capacity!: number;
  @ApiPropertyOptional({ description: 'Optional per-departure price override' })
  @IsOptional() @IsNumber() @Min(0)
  priceOverride?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateItineraryDayDto {
  @ApiProperty() @IsInt() @Min(1) dayNumber!: number;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  meals?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() accommodation?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  activities?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
}

export class CancellationPolicyDto {
  @ApiProperty({ description: 'Days before departure for full refund', default: 90 })
  @IsInt() @Min(0)
  fullRefundDaysBefore!: number;

  @ApiProperty({ description: 'Days before departure for half refund', default: 60 })
  @IsInt() @Min(0)
  halfRefundDaysBefore!: number;
}

export class CreateTourDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) shortDesc?: string;

  // Primary date range — kept for back-compat with existing list/search; the
  // bookable instances live in `departures[]`.
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() meetingPoint?: string;

  @ApiProperty() @IsNumber() @Min(0) basePrice!: number;
  @ApiProperty() @IsInt() @Min(1) capacity!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() coverImageUrl?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  imageUrls?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  highlights?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  included?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  notIncluded?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() requirements?: string;

  @ApiPropertyOptional({ description: 'EASY | MODERATE | CHALLENGING' })
  @IsOptional() @IsIn(['EASY', 'MODERATE', 'CHALLENGING'])
  difficultyLevel?: string;

  @ApiPropertyOptional({ description: 'ADVENTURE | HEALING — drives public listing tabs' })
  @IsOptional() @IsIn(['ADVENTURE', 'HEALING'])
  trackType?: string;

  @ApiPropertyOptional({ description: 'Guide\'s latest announcement shown on the public tour card' })
  @IsOptional() @IsString() @MaxLength(500)
  latestUpdate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ description: 'Per-person minimum deposit (USD)' })
  @IsOptional() @IsNumber() @Min(0)
  minDepositPerPerson?: number;

  @ApiPropertyOptional({ description: 'Legacy total min deposit — kept for back-compat' })
  @IsOptional() @IsNumber() @Min(0)
  depositMin?: number;

  @ApiPropertyOptional({ description: 'Days before departure when balance is due', default: 60 })
  @IsOptional() @IsInt() @Min(0)
  balanceDueDaysBefore?: number;

  @ApiPropertyOptional({ type: CancellationPolicyDto })
  @IsOptional() @ValidateNested() @Type(() => CancellationPolicyDto)
  cancellationPolicy?: CancellationPolicyDto;

  @ApiPropertyOptional({ type: [CreateRoomTypeDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateRoomTypeDto)
  roomTypes?: CreateRoomTypeDto[];

  @ApiPropertyOptional({ type: [CreateDepartureDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateDepartureDto)
  departures?: CreateDepartureDto[];

  @ApiPropertyOptional({ type: [CreateItineraryDayDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateItineraryDayDto)
  itinerary?: CreateItineraryDayDto[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
}
