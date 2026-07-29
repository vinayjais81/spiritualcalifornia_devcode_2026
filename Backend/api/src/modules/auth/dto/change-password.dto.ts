import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Body for `POST /auth/change-password`. Was an inline type literal, which
 * ValidationPipe skips — the endpoint accepted any shape, including a missing
 * `currentPassword` (which then reached bcrypt.compare as undefined).
 *
 * Deliberately NOT decorated with @IsStrongPassword, unlike RegisterDto and
 * ClaimAccountDto. AuthService.changePassword already runs checkPasswordPolicy
 * plus assertPasswordNotPersonal (which needs the user's name/email, unknown
 * at DTO level) and returns a single joined message. Adding the decorator here
 * would fire first and hand the settings page a differently-shaped error for
 * the same failure. Policy stays owned by the service; this is shape only.
 */
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Current password is required.' })
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    description:
      '10–128 chars, must include uppercase, lowercase, digit, and special character. Enforced by AuthService.changePassword.',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required.' })
  @MaxLength(128)
  newPassword!: string;
}
