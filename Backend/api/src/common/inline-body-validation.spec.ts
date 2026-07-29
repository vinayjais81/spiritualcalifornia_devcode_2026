import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ChatDto, AiQueryDto } from '../modules/ai/dto/ai-request.dto';
import {
  CreatePaymentIntentDto,
  ConfirmPaymentDto,
  RequestPayoutDto,
  RefundPaymentDto,
  SubscriptionCheckoutDto,
} from '../modules/payments/dto/payment-intent.dto';
import { ChangePasswordDto } from '../modules/auth/dto/change-password.dto';
import { ReviewNotesDto } from '../modules/verification/dto/review-notes.dto';
import { UpdateLeadStatusDto } from '../modules/contact/dto/update-lead-status.dto';
import { UpdateOnboardingStepDto } from '../modules/seekers/dto/update-onboarding-step.dto';
import { ReplaceItineraryDto } from '../modules/soul-tours/dto/replace-itinerary.dto';
import { SetActiveDto, SetPublishedDto, SetFeaturedDto } from '../modules/admin/dto/toggle-flag.dto';
import { FlagReviewDto, ModerateReviewDto } from '../modules/reviews/dto/moderate-review.dto';
import { CancelBookingReasonDto } from '../modules/bookings/dto/cancel-booking-reason.dto';
import { OrderSummaryDto } from '../modules/checkout/dto/order-summary.dto';

// Cover for the inline-@Body() validation sweep.
//
// Every DTO below replaced an `@Body() body: { ... }` type literal or a
// `@Body('field')` primitive — both of which Nest's global ValidationPipe
// skips, leaving the endpoint completely unvalidated. These tests assert the
// bodies are now actually checked. See docs/inline-body-validation-sweep.md.

// Same options as the global pipe in main.ts.
const check = (cls: any, body: unknown) =>
  validateSync(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const ok = (cls: any, body: unknown) => expect(check(cls, body)).toHaveLength(0);
const bad = (cls: any, body: unknown) => expect(check(cls, body).length).toBeGreaterThan(0);

describe('AI request DTOs (public, per-request Claude spend)', () => {
  it('accepts a normal chat turn', () => {
    ok(ChatDto, { message: 'How do I start meditating?' });
    ok(ChatDto, {
      message: 'And after that?',
      history: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
    });
  });

  it('rejects an empty or oversized message', () => {
    bad(ChatDto, { message: '' });
    bad(ChatDto, { message: 'a'.repeat(2001) });
    bad(ChatDto, {});
  });

  it('bounds conversation history length and content', () => {
    bad(ChatDto, { message: 'hi', history: Array(21).fill({ role: 'user', content: 'x' }) });
    bad(ChatDto, { message: 'hi', history: [{ role: 'system', content: 'x' }] });
    bad(ChatDto, { message: 'hi', history: [{ role: 'user', content: 'x'.repeat(4001) }] });
  });

  it('bounds the product-finder / practitioner-match query', () => {
    ok(AiQueryDto, { query: 'something calming for sleep' });
    bad(AiQueryDto, { query: 'x'.repeat(501) });
    bad(AiQueryDto, { query: '' });
  });
});

describe('Payment DTOs', () => {
  it('accepts a well-formed intent', () => {
    ok(CreatePaymentIntentDto, { amount: 120, bookingId: 'bk_1', paymentType: 'FULL' });
  });

  it('rejects amounts that used to reach Stripe unchecked', () => {
    bad(CreatePaymentIntentDto, { amount: -50 });
    bad(CreatePaymentIntentDto, { amount: 0 });
    bad(CreatePaymentIntentDto, { amount: 0.1 }); // below Stripe's $0.50 minimum
    bad(CreatePaymentIntentDto, { amount: 'free' });
    bad(CreatePaymentIntentDto, { amount: 1e9 });
    bad(CreatePaymentIntentDto, {});
  });

  // Regression guard: an earlier draft of this DTO used
  // `@IsNumber({ maxDecimalPlaces: 2 })`, which rejects ordinary cart totals
  // because float addition leaks precision (79.99 + 6.60 = 86.58999999999999).
  // That would have 400'd real checkouts. Keep these passing.
  it('accepts float-artifact totals produced by summing line items', () => {
    ok(CreatePaymentIntentDto, { amount: 79.99 + 6.6 });
    ok(CreatePaymentIntentDto, { amount: 19.99 + 1.65 });
    ok(RequestPayoutDto, { amount: 100.1 + 0.2 });
  });

  it('rejects an unknown paymentType', () => {
    bad(CreatePaymentIntentDto, { amount: 10, paymentType: 'PARTIAL' });
  });

  it('validates the remaining payment bodies', () => {
    ok(ConfirmPaymentDto, { paymentIntentId: 'pi_123' });
    bad(ConfirmPaymentDto, { paymentIntentId: '' });

    ok(RequestPayoutDto, { amount: 250 });
    bad(RequestPayoutDto, { amount: -250 });

    // Refund amount is optional (omit = full refund) but bounded when present.
    ok(RefundPaymentDto, {});
    bad(RefundPaymentDto, { amount: 0 });

    // Plan stays optional — the controller has always defaulted to monthly.
    ok(SubscriptionCheckoutDto, {});
    ok(SubscriptionCheckoutDto, { plan: 'annual' });
    bad(SubscriptionCheckoutDto, { plan: 'lifetime' });
  });
});

describe('Remaining swept DTOs', () => {
  it('ChangePasswordDto requires both passwords', () => {
    ok(ChangePasswordDto, { currentPassword: 'old-one', newPassword: 'Sun$hine-Path7' });
    bad(ChangePasswordDto, { newPassword: 'Sun$hine-Path7' });
    bad(ChangePasswordDto, { currentPassword: '', newPassword: 'x' });
  });

  it('ReviewNotesDto bounds the reviewer note', () => {
    ok(ReviewNotesDto, {});
    ok(ReviewNotesDto, { notes: 'Credential verified against issuing body.' });
    bad(ReviewNotesDto, { notes: 'a'.repeat(1001) });
  });

  it('UpdateLeadStatusDto only accepts the three real statuses', () => {
    ok(UpdateLeadStatusDto, { status: 'in_progress' });
    bad(UpdateLeadStatusDto, { status: 'in progress' });
    bad(UpdateLeadStatusDto, { status: 'archived' });
  });

  it('UpdateOnboardingStepDto bounds the wizard step', () => {
    ok(UpdateOnboardingStepDto, { step: 3 });
    ok(UpdateOnboardingStepDto, { step: 5, completed: true });
    bad(UpdateOnboardingStepDto, { step: 0 });
    bad(UpdateOnboardingStepDto, { step: -1 });
    bad(UpdateOnboardingStepDto, { step: 2.5 });
    bad(UpdateOnboardingStepDto, { step: 999 });
  });

  it('ReplaceItineraryDto now actually validates nested days', () => {
    ok(ReplaceItineraryDto, {
      days: [{ dayNumber: 1, title: 'Arrival', description: 'Settle in.' }],
    });
    // The whole point of the fix: CreateItineraryDayDto's decorators never ran
    // while the body was an inline `{ days: CreateItineraryDayDto[] }`.
    bad(ReplaceItineraryDto, { days: [{ dayNumber: 0, title: 'x', description: 'y' }] });
    bad(ReplaceItineraryDto, { days: [{ title: 'missing dayNumber' }] });
    bad(ReplaceItineraryDto, { days: Array(366).fill({ dayNumber: 1, title: 'a', description: 'b' }) });
  });

  it('boolean toggles reject non-booleans and empty bodies', () => {
    ok(SetActiveDto, { isActive: false });
    bad(SetActiveDto, {});
    bad(SetActiveDto, { isActive: 'yes' });

    ok(SetPublishedDto, { isPublished: true });
    bad(SetPublishedDto, {});

    ok(SetFeaturedDto, { isFeatured: true });
    bad(SetFeaturedDto, { isFeatured: null });

    ok(FlagReviewDto, { flag: true });
    bad(FlagReviewDto, {});

    ok(ModerateReviewDto, { approved: false });
    bad(ModerateReviewDto, {});
  });

  it('CancelBookingReasonDto bounds the free-text reason', () => {
    ok(CancelBookingReasonDto, {});
    bad(CancelBookingReasonDto, { reason: 'a'.repeat(501) });
  });

  it('OrderSummaryDto requires items — the body was previously `any`', () => {
    ok(OrderSummaryDto, { items: [{ productId: 'p1', quantity: 2 }] });
    // This one 500'd on `data.items.map` before the DTO existed.
    bad(OrderSummaryDto, {});
    bad(OrderSummaryDto, { items: [] });
    bad(OrderSummaryDto, { items: [{ productId: 'p1', quantity: 0 }] });
    bad(OrderSummaryDto, { items: [{ productId: 'p1', quantity: 1.5 }] });
  });
});
