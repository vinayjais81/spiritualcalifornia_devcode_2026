import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class SetUserPasswordDto {
  @ApiProperty({
    example: 'Sun$hine-Path7',
    description:
      '10–128 chars, must include uppercase, lowercase, digit, and special character. Cannot be a common password or contain the target user\'s name/email.',
  })
  @IsString()
  @IsStrongPassword()
  newPassword!: string;

  @ApiProperty({
    description:
      'Required justification — surfaced in the audit log and in the email sent to the affected user.',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  reason!: string;
}
