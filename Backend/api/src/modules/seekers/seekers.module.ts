import { Module } from '@nestjs/common';
import { SeekersController } from './seekers.controller';
import { SeekersService } from './seekers.service';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [CartModule],
  controllers: [SeekersController],
  providers: [SeekersService],
  exports: [SeekersService],
})
export class SeekersModule {}
