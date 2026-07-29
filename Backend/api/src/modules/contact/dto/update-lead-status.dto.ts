import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * Body for `PATCH /contact/leads/:id/status`. Was an inline type literal, so
 * any string reached `contactLead.status` — the column is a free-text String
 * with no DB constraint, and the admin list buckets/filters on exact values,
 * so a typo silently made a lead invisible in every tab.
 *
 * Values match STATUS_OPTIONS in the admin contacts page.
 */
export const CONTACT_LEAD_STATUSES = ['new', 'in_progress', 'resolved'] as const;

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: CONTACT_LEAD_STATUSES })
  @IsIn(CONTACT_LEAD_STATUSES, {
    message: `Status must be one of: ${CONTACT_LEAD_STATUSES.join(', ')}.`,
  })
  status!: (typeof CONTACT_LEAD_STATUSES)[number];
}
