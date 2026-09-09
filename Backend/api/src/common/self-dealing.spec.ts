import { readFileSync } from 'fs';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';
import { assertNotOwnListing, SELF_PURCHASE_MESSAGE } from './self-dealing';

// Cover for the self-dealing guards that make practitioner buying safe.
// See docs/practitioners-as-buyers.md (Phase 0).

describe('assertNotOwnListing', () => {
  it('allows a purchase from another practitioner', () => {
    expect(() => assertNotOwnListing('user_buyer', 'user_seller')).not.toThrow();
  });

  it('refuses when the buyer owns the listing', () => {
    expect(() => assertNotOwnListing('user_same', 'user_same')).toThrow(ForbiddenException);
    expect(() => assertNotOwnListing('user_same', 'user_same')).toThrow(SELF_PURCHASE_MESSAGE);
  });

  it('names the offending item when one is given', () => {
    // A shop cart mixes several practitioners' products; an unqualified
    // refusal leaves the buyer hunting for which line caused it.
    expect(() => assertNotOwnListing('u1', 'u1', 'Rose Quartz Mala')).toThrow(/Rose Quartz Mala/);
  });

  it('refuses rather than allows when the owner cannot be resolved', () => {
    // A missing owner is not a licence to proceed. If this ever inverted, a
    // listing whose guide row went missing would become freely self-buyable.
    expect(() => assertNotOwnListing('u1', null)).toThrow(ForbiddenException);
    expect(() => assertNotOwnListing('u1', undefined)).toThrow(ForbiddenException);
    expect(() => assertNotOwnListing('u1', '')).toThrow(ForbiddenException);
  });
});

// The guards matter as a set: one purchase path left unguarded reopens the
// whole hole, and nothing in the type system says a checkout must call this.
// A source-level check is crude, but it fails loudly when a refactor drops a
// call — which is the failure mode this codebase has actually hit before
// (nested price edits, PUBLIC_GUIDE_WHERE on offering reads).
describe('every purchase path is guarded', () => {
  const paths: Array<[string, string]> = [
    ['services (Calendly checkout + slot booking)', 'bookings/bookings.service.ts'],
    ['products (shop order)', 'orders/orders.service.ts'],
    ['events (ticket checkout)', 'tickets/tickets.service.ts'],
    ['tours (deposit booking)', 'soul-tours/soul-tours.service.ts'],
    ['favourites', 'seekers/seekers.service.ts'],
  ];

  it.each(paths)('%s calls the guard', (_label, file) => {
    const src = readFileSync(join(__dirname, '..', 'modules', file), 'utf8');
    expect(src).toContain("from '../../common/self-dealing'");
    expect(src).toMatch(/assertNotOwn(Listing|GuideProfile)\(/);
  });

  it('bookings guards both of its two entry points', () => {
    // createServiceBooking and create are separate paths to the same Booking
    // row; guarding only the one the UI happens to use today is not enough.
    const src = readFileSync(join(__dirname, '..', 'modules', 'bookings/bookings.service.ts'), 'utf8');
    const calls = src.match(/assertNotOwnListing\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('reviews refuse a self-review independently of the purchase guards', () => {
    // Second line of defence: eligibility requires a completed purchase, so
    // this only fires if a self-purchase got through anyway.
    const src = readFileSync(join(__dirname, '..', 'modules', 'reviews/reviews.service.ts'), 'utf8');
    expect(src).toMatch(/eligibility\.guideUserId === userId/);
  });
});
