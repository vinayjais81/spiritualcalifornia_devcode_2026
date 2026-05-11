import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, IsOptional, IsBoolean, IsIn, IsArray } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Sun$hine-Path7',
    description:
      '10–128 chars, must include uppercase, lowercase, digit, and special character. Cannot be a common password.',
  })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({ example: '+1 (415) 000-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'Los Angeles, CA' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ example: true, description: 'Opt in to marketing / newsletter emails' })
  @IsOptional()
  @IsBoolean()
  newsletterOptIn?: boolean;

  /**
   * Which role the user is registering for. SEEKER and GUIDE are mutually
   * exclusive on the same email — see GuidesService.startOnboarding for the
   * symmetric guard. ADMIN/SUPER_ADMIN are exempt and managed separately.
   *
   *   - 'seeker' (default) → assigns SEEKER role + creates SeekerProfile
   *   - 'guide'            → assigns no role yet; /guides/onboarding/start
   *                          will assign GUIDE and create GuideProfile
   */
  @ApiPropertyOptional({ enum: ['seeker', 'guide'], default: 'seeker' })
  @IsOptional()
  @IsIn(['seeker', 'guide'])
  intent?: 'seeker' | 'guide';

  // ─── Optional guide-wizard profile fields ────────────────────────────────
  // When intent='guide' and the user fills wizard step 1 before submitting,
  // these come along on the register call. They're stashed on the user row
  // (pendingProfileJson) and applied to the GuideProfile in /auth/verify-email.
  // Without this passthrough, the user types data that silently dies between
  // the wizard's local state and the server.

  @ApiPropertyOptional({ example: 'Sound Healer · Reiki Master' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @ApiPropertyOptional({ example: '20-year practitioner of...' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: 'America/Los_Angeles' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string;

  @ApiPropertyOptional({ example: ['English', 'Spanish'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];
}
