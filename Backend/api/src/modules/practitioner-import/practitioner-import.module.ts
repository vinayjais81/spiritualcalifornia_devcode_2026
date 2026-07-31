import { Module } from '@nestjs/common';
import { PractitionerImportController } from './practitioner-import.controller';
import { PractitionerImportService } from './practitioner-import.service';

/**
 * Admin bulk import of practitioner lists (Phase 1 of
 * docs/practitioner-import-invite-strategy.md).
 *
 * Deliberately has no dependency on the email layer: this phase parses,
 * classifies and creates dormant accounts. Nothing here can send a message to a
 * practitioner, which is what makes it safe to ship before the sender identity,
 * pricing and unsubscribe decisions are settled.
 */
@Module({
  controllers: [PractitionerImportController],
  providers: [PractitionerImportService],
  exports: [PractitionerImportService],
})
export class PractitionerImportModule {}
