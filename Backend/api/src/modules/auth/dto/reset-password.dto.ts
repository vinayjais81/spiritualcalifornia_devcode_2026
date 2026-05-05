import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({
    example: 'Sun$hine-Path7',
    description:
      '10–128 chars, must include uppercase, lowercase, digit, and special character. Cannot be a common password.',
  })
  @IsString()
  @IsStrongPassword()
  password: string;
}
