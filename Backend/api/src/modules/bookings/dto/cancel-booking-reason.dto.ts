import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for `PATCH /bookings/:id/cancel`. Was `@Body('reason') reason?: string`
 * — a primitive metatype, which ValidationPipe skips, so the free-text
 * cancellation reason was stored unbounded.
 *
 * Cap matches DeactivateUserDto's reason field in the admin module.
 */
export class CancelBookingReasonDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Reason must be 500 characters or fewer.' })
  reason?: string;
}
