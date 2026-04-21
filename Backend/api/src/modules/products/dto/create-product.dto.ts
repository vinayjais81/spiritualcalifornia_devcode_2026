import { IsString, IsEnum, IsNumber, IsOptional, IsArray, IsBoolean, IsPositive, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, ProductCategory } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  type: ProductType;

  @ApiPropertyOptional({ enum: ProductCategory, description: 'Shop category for filtering' })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @ApiProperty({ example: '30-Day Awareness Training' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 29 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 'Describe what makes this product special…' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  /** S3 key for the downloadable file (DIGITAL products only) */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fileS3Key?: string;

  /** S3 keys or CDN URLs for product photos (PHYSICAL products only, max 5) */
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];

  /** Physical stock quantity (null = unlimited for digital) */
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  /** Digital files metadata: [{ name, size, url }] */
  @ApiPropertyOptional({ description: 'Array of digital file objects with name, size, url' })
  @IsOptional()
  digitalFiles?: any;

  /** Publish state — true = visible on /shop, false = hidden draft. Defaults to true. */
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
