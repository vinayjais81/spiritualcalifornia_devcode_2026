import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `POST /soul-tours/bookings/:bookingId/consent`.
 *
 * Captures the clickwrap acceptance shown to the customer on the tour-
 * booking Step 4 panel just before the Stripe redirect. Required by the
 * compliance implementation spec (2026-05-22, Task 4e). Server-side
 * fills in `acceptedAt` (CURRENT_TIMESTAMP) and `ip` (from request) —
 * those aren't accepted from the client to avoid tampering.
 *
 * `docVersions` is a free-form record of doc → version-string pairs.
 * Today: `{ terms, privacy, refund, disclosures }`. Stored as JSON so
 * adding more documents later (e.g. a per-tour Participant Agreement)
 * doesn't require a schema migration.
 */
export class RecordConsentDto {
  @ApiProperty({
    description:
      'Verbatim copy of the checkbox label as shown to the customer. Persisted so we can reproduce exactly what was agreed to even if the on-screen copy changes later.',
    minLength: 20,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  consentText!: string;

  @ApiProperty({
    description:
      'Per-document version tags at acceptance time (e.g. { terms: "2026-05-22", privacy: "2026-05-22", refund: "2026-05-22", disclosures: "2026-05-22" }). Source: Frontend/web/src/lib/legalDocVersions.',
    example: {
      terms: '2026-05-22',
      privacy: '2026-05-22',
      refund: '2026-05-22',
      disclosures: '2026-05-22',
    },
  })
  @IsObject()
  docVersions!: Record<string, string>;
}
