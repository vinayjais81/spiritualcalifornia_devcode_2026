import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Body for `POST /checkout/summary`. Was `@Body() data: any` — not merely
 * unvalidated but explicitly opted out of typing, so a body missing `items`
 * reached `data.items.map(...)` and 500'd on a TypeError.
 */
export class OrderSummaryItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  variantId?: string;

  @ApiProperty({ minimum: 1, maximum: 999 })
  @IsInt({ message: 'Quantity must be a whole number.' })
  @Min(1, { message: 'Quantity must be at least 1.' })
  @Max(999, { message: 'Quantity must be 999 or less.' })
  quantity!: number;
}

export class OrderSummaryDto {
  @ApiProperty({ type: [OrderSummaryItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required.' })
  @ArrayMaxSize(100, { message: 'A cart cannot exceed 100 line items.' })
  @ValidateNested({ each: true })
  @Type(() => OrderSummaryItemDto)
  items!: OrderSummaryItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shippingMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promoCode?: string;

  @ApiPropertyOptional({ description: 'Two-letter state code, used for the tax rate lookup.' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;
}
