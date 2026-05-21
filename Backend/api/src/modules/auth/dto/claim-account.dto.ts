import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

/**
 * Body for `POST /auth/claim-account`. Combined verify-email + set-password
 * step for pre-launch test accounts after the admin swaps the email. The
 * `token` is the same `emailVerifyToken` minted by AdminService.
 * convertTestAccount; consuming it both verifies the new email and sets
 * the first real password.
 */
export class ClaimAccountDto {
  @ApiProperty({ description: 'One-time claim token from the invite email.' })
  @IsString()
  token!: string;

  @ApiProperty({
    example: 'Sun$hine-Path7',
    description:
      '10–128 chars, must include uppercase, lowercase, digit, and special character. Cannot be a common password.',
  })
  @IsString()
  @IsStrongPassword()
  password!: string;
}
