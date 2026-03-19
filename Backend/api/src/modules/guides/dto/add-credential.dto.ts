import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCredentialDto {
  @ApiProperty({ example: 'Certified Meditation Teacher' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Chopra Center' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  @ApiPropertyOptional({ example: 2021 })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear())
  issuedYear?: number;

  @ApiPropertyOptional({ description: 'S3 key of uploaded credential document' })
  @IsOptional()
  @IsString()
  documentS3Key?: string;
}
