import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Body for `PATCH /admin/users/:id/test-account-flag`. Single-field DTO so
 * the global `forbidNonWhitelisted` validation pipe rejects unexpected
 * payloads instead of silently flipping the flag on.
 */
export class SetTestAccountFlagDto {
  @ApiProperty({ description: 'Target value for User.isTestAccount.' })
  @IsBoolean()
  isTestAccount!: boolean;
}

/**
 * Body for `PATCH /admin/users/:id/convert-test-account`.
 *
 * Used in the pre-launch onboarding flow: admin self-registers guides using
 * fake throwaway emails on the configured test domain (default
 * `scprelaunch.test`). When the real email arrives, admin posts this DTO to
 * swap the email and fire a claim-invite to the real address.
 */
export class ConvertTestAccountDto {
  @ApiProperty({
    example: 'real.guide@gmail.com',
    description:
      'The real email address to assign to this account. Must be unique platform-wide and is what the claim-invite is sent to.',
  })
  @IsEmail()
  newEmail!: string;

  @ApiPropertyOptional({
    description:
      'When true (default), immediately emails the new address with a one-time link to verify the email + set a fresh password. Set false to swap the email silently and trigger the invite later.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  sendInvite?: boolean;

  @ApiPropertyOptional({
    description:
      'Required justification — surfaced in the audit log so we can trace who converted which test account to what real email.',
    minLength: 3,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
