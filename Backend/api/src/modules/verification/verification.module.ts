import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  // PaymentsModule exports StripeService, used here for Stripe Identity
  // verification sessions + webhook signature checks. No cycle: PaymentsModule
  // does not depend on Verification/Guides.
  imports: [ConfigModule, PaymentsModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
