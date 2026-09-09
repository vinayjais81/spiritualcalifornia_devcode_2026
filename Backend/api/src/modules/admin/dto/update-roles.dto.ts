import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateRolesDto {
  // Replaces the whole role set, so an empty array would silently strip every
  // role and lock the account out of its own dashboard. The service rejects it
  // too — this just fails it earlier, with a field-level message.
  @ApiProperty({ enum: Role, isArray: true })
  @IsArray()
  @ArrayNotEmpty({ message: 'Select at least one role.' })
  @IsEnum(Role, { each: true })
  roles: Role[];
}
