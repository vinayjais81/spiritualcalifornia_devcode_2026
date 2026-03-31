import { applyDecorators, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

/**
 * Strict rate limiting for sensitive endpoints.
 * Auth endpoints: 5 requests per 60 seconds
 * Payment endpoints: 10 requests per 60 seconds
 * AI endpoints: 20 requests per 60 seconds
 */
export function StrictThrottle() {
  return applyDecorators(
    Throttle({ short: { limit: 5, ttl: 60000 } }),
    UseGuards(ThrottlerGuard),
  );
}

export function PaymentThrottle() {
  return applyDecorators(
    Throttle({ short: { limit: 10, ttl: 60000 } }),
    UseGuards(ThrottlerGuard),
  );
}

export function AIThrottle() {
  return applyDecorators(
    Throttle({ short: { limit: 20, ttl: 60000 } }),
    UseGuards(ThrottlerGuard),
  );
}
