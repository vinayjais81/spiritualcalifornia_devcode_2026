import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min, IsEmail, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty() @IsString() productId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() variantId?: string;
  @ApiProperty() @IsInt() @Min(1) quantity: number;
}

export class ShippingAddressDto {
  @ApiProperty() @IsString() street: string;
  @ApiPropertyOptional() @IsOptional() @IsString() apartment?: string;
  @ApiProperty() @IsString() city: string;
  @ApiProperty() @IsString() state: string;
  @ApiProperty() @IsString() zipCode: string;
  @ApiProperty() @IsString() country: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty() @IsEmail() contactEmail: string;
  @ApiProperty() @IsString() contactFirstName: string;
  @ApiProperty() @IsString() contactLastName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPhone?: string;

  @ApiPropertyOptional({ type: ShippingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @ApiPropertyOptional() @IsOptional() @IsString() shippingMethodId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() promoCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
