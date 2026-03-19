import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectGuideDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @MaxLength(1000)
  reason: string;
}
