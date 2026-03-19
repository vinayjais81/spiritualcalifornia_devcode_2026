import { Module } from '@nestjs/common';
import { SeekersController } from './seekers.controller';
import { SeekersService } from './seekers.service';

@Module({
  controllers: [SeekersController],
  providers: [SeekersService],
  exports: [SeekersService],
})
export class SeekersModule {}
