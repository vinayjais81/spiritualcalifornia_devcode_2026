import { IsEnum, IsString, IsOptional, IsInt, Min, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CartItemType } from '@prisma/client';

export class AddCartItemDto {
  @ApiProperty({ enum: CartItemType })
  @IsEnum(CartItemType)
  itemType: CartItemType;

  @ApiProperty({ description: 'ID of the product, event tier, tour, or service' })
  @IsString()
  itemId: string;

  @ApiPropertyOptional({ description: 'Product variant ID (for physical products with sizes)' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Extra data (selected date, room type, etc.)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
