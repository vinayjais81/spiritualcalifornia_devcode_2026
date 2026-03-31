import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DownloadsService } from './downloads.service';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PaymentsModule, CheckoutModule, UploadModule],
  controllers: [OrdersController],
  providers: [OrdersService, DownloadsService],
  exports: [OrdersService, DownloadsService],
})
export class OrdersModule {}
