import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeactivateUserDto {
  @ApiProperty({
    description:
      'Required justification — surfaced in the audit log. Visible to other admins, not to the affected user.',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
