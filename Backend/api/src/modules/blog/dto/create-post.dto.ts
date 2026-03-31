import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ example: 'The Art of Stillness: Why Doing Nothing Is Everything' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: '<p>In a culture that glorifies productivity...</p>' })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional({ example: 'In a culture that glorifies productivity, learning to be still is perhaps the most radical act...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/...' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['meditation', 'mindfulness'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Publish immediately (true) or save as draft (false)', default: false })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
