import { Module } from '@nestjs/common';
import { SoulToursController } from './soul-tours.controller';
import { SoulToursService } from './soul-tours.service';
import { TourTasksQueue } from './tour-tasks.queue';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [SoulToursController],
  providers: [SoulToursService, TourTasksQueue],
  exports: [SoulToursService],
})
export class SoulToursModule {}
