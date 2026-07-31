import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class IssueClaimTokenDto {
  @ApiProperty({ description: 'User id of the invited guide' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  userId!: string;
}
