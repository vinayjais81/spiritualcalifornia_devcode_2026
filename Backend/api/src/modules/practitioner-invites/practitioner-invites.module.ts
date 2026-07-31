import { Module } from '@nestjs/common';
import { PractitionerImportModule } from '../practitioner-import/practitioner-import.module';
import { PractitionerInvitesController } from './practitioner-invites.controller';
import { PractitionerInvitesService } from './practitioner-invites.service';

/**
 * The practitioner's side of a proactive invite: claim the account, or remove
 * yourself from the platform entirely.
 *
 * Phase 2 of docs/practitioner-import-invite-strategy.md. Still no sending —
 * this module mints the links and honours them; Phase 3 adds the queue that
 * puts them in an email. Building it in this order means the first real invite
 * goes out into a system where both outcomes are already tested.
 */
@Module({
  imports: [PractitionerImportModule],
  controllers: [PractitionerInvitesController],
  providers: [PractitionerInvitesService],
  exports: [PractitionerInvitesService],
})
export class PractitionerInvitesModule {}
