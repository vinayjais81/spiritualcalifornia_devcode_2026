import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Bodies for POST /payments/create-intent and /payments/confirm-payment.
 *
 * Both were inline `@Body()` type literals, so the global ValidationPipe never
 * ran on them: `amount` accepted anything JSON could express — a string, NaN,
 * a negative, 1e21 — and flowed into `Math.round(amount * 100)` and the
 * commission split before reaching Stripe.
 *
 * NOTE: this validates the *shape* of `amount`, not its correctness. The
 * client still asserts the figure and the server does not recompute it from
 * the referenced booking/order. Bounding it is not the same as trusting it —
 * see the "Known gap" section of docs/inline-body-validation-sweep.md.
 */
export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Charge amount in dollars (not cents).',
    minimum: 0.5,
    maximum: 100000,
    example: 120,
  })
  // Deliberately NOT `maxDecimalPlaces: 2`. Totals arrive as the sum of
  // floats — `79.99 + 6.60` is 86.58999999999999 in IEEE-754 — so a 2dp
  // constraint would reject perfectly ordinary carts. StripeService already
  // does `Math.round(amount * 100)` before charging.
  @IsNumber({}, { message: 'Amount must be a number.' })
  // Stripe's own minimum charge is $0.50 USD; anything below always errors.
  @Min(0.5, { message: 'Amount must be at least $0.50.' })
  @Max(100000, { message: 'Amount exceeds the maximum single-charge limit.' })
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ticketPurchaseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tourBookingId?: string;

  @ApiPropertyOptional({ enum: ['FULL', 'DEPOSIT', 'BALANCE'] })
  @IsOptional()
  @IsIn(['FULL', 'DEPOSIT', 'BALANCE'])
  paymentType?: 'FULL' | 'DEPOSIT' | 'BALANCE';
}

export class ConfirmPaymentDto {
  @ApiProperty({ example: 'pi_3ABC123def456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  paymentIntentId!: string;
}

/** Body for POST /payments/payout — was `@Body('amount') amount: number`. */
export class RequestPayoutDto {
  @ApiProperty({ description: 'Payout amount in dollars.', minimum: 1, example: 250 })
  // No maxDecimalPlaces — see the note on CreatePaymentIntentDto.amount.
  @IsNumber({}, { message: 'Amount must be a number.' })
  @Min(1, { message: 'Payout amount must be at least $1.' })
  @Max(1000000)
  amount!: number;
}

/** Body for POST /payments/:id/refund — was `@Body('amount') amount?: number`. */
export class RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Partial refund amount in dollars. Omit for a full refund.' })
  @IsOptional()
  // No maxDecimalPlaces — see the note on CreatePaymentIntentDto.amount.
  @IsNumber({}, { message: 'Amount must be a number.' })
  @Min(0.01, { message: 'Refund amount must be greater than zero.' })
  @Max(100000)
  amount?: number;
}

/**
 * Body for POST /payments/subscription/checkout — was `@Body('plan') plan`.
 * Optional on purpose: the controller has always defaulted a missing plan to
 * 'monthly', so requiring it here would 400 a request that used to succeed.
 */
export class SubscriptionCheckoutDto {
  @ApiPropertyOptional({ enum: ['monthly', 'annual'], default: 'monthly' })
  @IsOptional()
  @IsIn(['monthly', 'annual'], { message: 'Plan must be either monthly or annual.' })
  plan?: 'monthly' | 'annual';
}
