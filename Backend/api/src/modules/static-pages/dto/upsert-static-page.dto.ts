import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Used by both create and update from the admin panel. `slug` is only
 * settable on create; the controller blocks changes on update.
 */
export class UpsertStaticPageDto {
  @ApiProperty({
    description: 'URL slug, e.g. "privacy" → /privacy',
    example: 'privacy',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message:
      'Slug must be lowercase letters, digits, or hyphens, starting with a letter or digit',
  })
  slug: string;

  @ApiProperty({ example: 'Privacy Policy' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Overrides the <title> tag for SEO' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'Meta description for search engines' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'Small all-caps eyebrow above the title (e.g. "Legal")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eyebrow?: string;

  @ApiPropertyOptional({
    description: 'Italic serif intro paragraph below the title',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @ApiProperty({ description: 'Rich-text HTML body' })
  @IsString()
  @MinLength(10)
  body: string;

  @ApiPropertyOptional({
    description: 'Published (public-visible) or draft',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
