import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Admin creates a blog post. The author can be either an existing guide OR
 * an admin user — `authorKind` disambiguates.
 *
 *   - authorKind=guide → authorId is a GuideProfile.id, used directly.
 *   - authorKind=admin → authorId is a User.id. The service lazily creates a
 *     minimal (unpublished, unverified) GuideProfile for that admin if one
 *     doesn't already exist, so BlogPost.guideId stays satisfied.
 */
export class AdminCreatePostDto {
  @ApiProperty({ description: 'Guide profile id (when kind=guide) or admin user id (when kind=admin)' })
  @IsString()
  authorId: string;

  @ApiProperty({ enum: ['guide', 'admin'] })
  @IsIn(['guide', 'admin'])
  authorKind: 'guide' | 'admin';

  @ApiProperty({ example: 'The Art of Stillness' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Rich text (HTML) body' })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional({ description: 'S3 / CDN URL; required when publishing' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Publish immediately (true) or save as draft (false)', default: false })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

/**
 * Admin updates any post. Every field is optional; the admin can also
 * reassign the author (using the same authorId + authorKind pair as create).
 */
export class AdminUpdatePostDto {
  @ApiPropertyOptional({ description: 'Reassign the post to a different author' })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({ enum: ['guide', 'admin'] })
  @IsOptional()
  @IsIn(['guide', 'admin'])
  authorKind?: 'guide' | 'admin';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
