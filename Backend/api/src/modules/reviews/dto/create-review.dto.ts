import { IsString, IsInt, Min, Max, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReviewTargetType {
  SERVICE = 'SERVICE',
  EVENT = 'EVENT',
  TOUR = 'TOUR',
  PRODUCT = 'PRODUCT',
}

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewTargetType, description: 'What kind of purchase is being reviewed' })
  @IsEnum(ReviewTargetType)
  targetType!: ReviewTargetType;

  @ApiProperty({
    description:
      'The transaction id that proves the purchase: Booking.id (SERVICE), TicketPurchase.id (EVENT), TourBooking.id (TOUR), OrderItem.id (PRODUCT)',
  })
  @IsString()
  transactionId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}
