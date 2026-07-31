import { Module } from '@nestjs/common';
import { PractitionerImportModule } from '../practitioner-import/practitioner-import.module';
import { PractitionerInvitesController } from './practitioner-invites.controller';
import { PractitionerInvitesService } from './practitioner-invites.service';
import { InviteSenderService } from './invite-sender.service';
import { InviteTasksQueue } from './invite-tasks.queue';
import { InviteWebhookController } from './invite-webhook.controller';

/**
 * Proactive practitioner invites, end to end: mint the links (Phase 2), honour
 * them, and send them in throttled waves (Phase 3).
 *
 * The claim and removal paths were deliberately built and tested *before*
 * anything could send, so the first real invite goes out into a system where
 * both outcomes already work.
 *
 * Sending defaults to redirect mode — see InviteSenderService.isLive.
 */
@Module({
  imports: [PractitionerImportModule],
  controllers: [PractitionerInvitesController, InviteWebhookController],
  providers: [PractitionerInvitesService, InviteSenderService, InviteTasksQueue],
  exports: [PractitionerInvitesService, InviteSenderService],
})
export class PractitionerInvitesModule {}
