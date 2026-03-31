import { Module } from '@nestjs/common';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';
import { VerificationModule } from '../verification/verification.module';
import { UploadModule } from '../upload/upload.module';
import { ServicesModule } from '../services/services.module';
import { EventsModule } from '../events/events.module';
import { ProductsModule } from '../products/products.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { BlogModule } from '../blog/blog.module';

@Module({
  imports: [
    VerificationModule,
    UploadModule,
    ServicesModule,
    EventsModule,
    ProductsModule,
    ReviewsModule,
    BlogModule,
  ],
  controllers: [GuidesController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}
