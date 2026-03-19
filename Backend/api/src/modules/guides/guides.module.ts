import { Module } from '@nestjs/common';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';
import { VerificationModule } from '../verification/verification.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [VerificationModule, UploadModule],
  controllers: [GuidesController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}
