import { IsString, IsOptional, IsNumber, IsDateString, IsInt, Min, IsArray, IsBoolean, MaxLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRoomTypeDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsNumber() @Min(0) pricePerNight: number;
  @ApiProperty() @IsNumber() @Min(0) totalPrice: number;
  @ApiProperty() @IsInt() @Min(1) capacity: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];
}

export class CreateTourDto {
  @ApiProperty() @IsString() @MaxLength(200) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) shortDesc?: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiProperty() @IsNumber() @Min(0) basePrice: number;
  @ApiProperty() @IsInt() @Min(1) capacity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() coverImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) included?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) notIncluded?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() requirements?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) depositMin?: number;

  @ApiPropertyOptional({ type: [CreateRoomTypeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoomTypeDto)
  roomTypes?: CreateRoomTypeDto[];
}
