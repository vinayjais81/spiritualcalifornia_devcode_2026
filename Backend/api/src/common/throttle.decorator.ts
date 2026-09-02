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

/**
 * Public forms that make the server send email to an address the CALLER
 * supplies. That combination is an open relay unless it is capped: whoever
 * posts the form chooses the recipient, and the mail leaves under our own
 * sending domain.
 *
 * The contact form had no throttle at all and was found being used exactly
 * that way — 430 submissions in 48 hours to 200 harvested third-party
 * addresses. See docs/contact-form-abuse.md.
 *
 * The window is an hour rather than a minute because a human contacts a
 * marketplace once, not five times a minute; a per-minute cap would still
 * have allowed thousands of messages a day from one address.
 */
export function PublicFormThrottle() {
  return applyDecorators(
    Throttle({ short: { limit: 5, ttl: 3600000 } }),
    UseGuards(ThrottlerGuard),
  );
}

export function AIThrottle() {
  return applyDecorators(
    Throttle({ short: { limit: 20, ttl: 60000 } }),
    UseGuards(ThrottlerGuard),
  );
}
