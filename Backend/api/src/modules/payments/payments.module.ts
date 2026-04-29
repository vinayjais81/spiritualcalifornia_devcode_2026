import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { LedgerService } from './ledger.service';
import { PayoutsTasksQueue } from './payouts-tasks.queue';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [NotificationsModule, UploadModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, LedgerService, PayoutsTasksQueue],
  exports: [PaymentsService, StripeService, LedgerService],
})
export class PaymentsModule {}
