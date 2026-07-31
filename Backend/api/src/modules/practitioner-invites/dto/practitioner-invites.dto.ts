import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class IssueClaimTokenDto {
  @ApiProperty({ description: 'User id of the invited guide' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  userId!: string;
}

export class QueueWaveDto {
  /**
   * Which slice of the batch to queue. Personal addresses go first: they carry
   * the best engagement signal, and early engagement is what teaches mailbox
   * providers to trust a new sending domain. Role inboxes (info@, office@)
   * reach a front desk and are sent last.
   */
  @ApiPropertyOptional({ enum: ['personal', 'role-inbox', 'all'], default: 'personal' })
  @IsOptional()
  @IsEnum(['personal', 'role-inbox', 'all'] as const)
  segment?: 'personal' | 'role-inbox' | 'all';
}

export class PauseWaveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
