import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BanUserDto {
  @ApiPropertyOptional({ description: 'Reason for banning the user' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
