import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsBoolean, IsIn } from 'class-validator';

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

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
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
}
