import { IsString, IsInt, Min, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookTourDto {
  @ApiProperty() @IsString() tourId: string;
  @ApiProperty() @IsString() roomTypeId: string;
  @ApiProperty() @IsInt() @Min(1) travelers: number;
  @ApiProperty() @IsString() contactFirstName: string;
  @ApiProperty() @IsString() contactLastName: string;
  @ApiProperty() @IsEmail() contactEmail: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specialRequests?: string;
  @ApiPropertyOptional({ description: 'If true, pay deposit only instead of full amount' })
  @IsOptional()
  depositOnly?: boolean;
}
