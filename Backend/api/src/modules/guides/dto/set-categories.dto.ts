import { IsArray, IsString, IsOptional, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategorySelectionDto {
  @ApiProperty({ example: 'clxxx...categoryId' })
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({ type: [String], description: 'Existing subcategory IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subcategoryIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'New custom subcategory names to create' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customSubcategoryNames?: string[];
}

export class SetCategoriesDto {
  @ApiProperty({ type: [CategorySelectionDto], minItems: 1, maxItems: 5 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CategorySelectionDto)
  categories: CategorySelectionDto[];

  @ApiPropertyOptional({ type: [String], description: 'Specific modality tags e.g. Reiki, Breathwork' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modalities?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Issues the guide helps with e.g. Anxiety, Burnout' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  issuesHelped?: string[];
}
