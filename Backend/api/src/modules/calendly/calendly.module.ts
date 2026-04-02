import { Module } from '@nestjs/common';
import { CalendlyController } from './calendly.controller';
import { CalendlyService } from './calendly.service';

@Module({
  controllers: [CalendlyController],
  providers: [CalendlyService],
  exports: [CalendlyService],
})
export class CalendlyModule {}
