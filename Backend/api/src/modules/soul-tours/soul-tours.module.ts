import { Module } from '@nestjs/common';
import { SoulToursController } from './soul-tours.controller';
import { SoulToursService } from './soul-tours.service';

@Module({
  controllers: [SoulToursController],
  providers: [SoulToursService],
  exports: [SoulToursService],
})
export class SoulToursModule {}
