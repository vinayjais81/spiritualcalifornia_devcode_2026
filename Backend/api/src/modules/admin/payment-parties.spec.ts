import { describePaymentParties } from './admin.service';

// Cover for the QA defect "Purchased event doesn't show seeker and guide in
// Transactions tab".
//
// Payment has four nullable source columns — bookingId, orderId,
// ticketPurchaseId, tourBookingId — and exactly one is set. getFinancials
// selected only `booking`, and the admin page read `payment.booking.seeker`
// directly, so a service booking rendered both names and an event ticket, tour
// booking or shop order rendered "—" for both. The parties were always in the
// database; nothing ever asked for them.

const guide = (displayName: string | null, firstName = 'Liana', lastName = 'Guide') => ({
  displayName,
  user: { firstName, lastName },
});
const seeker = (firstName = 'Yana', lastName = 'Seeker') => ({
  user: { firstName, lastName },
});

describe('describePaymentParties', () => {
  it('resolves a service booking', () => {
    expect(
      describePaymentParties({
        booking: { seeker: seeker(), service: { name: 'Reiki Session', guide: guide('Liana Guide') } },
      }),
    ).toEqual({
      sourceType: 'SERVICE',
      sourceLabel: 'Reiki Session',
      seekerName: 'Yana Seeker',
      guideName: 'Liana Guide',
    });
  });

  // ── The reported defect ───────────────────────────────────────────────────

  it('resolves an event ticket, reaching the guide through tier → event', () => {
    expect(
      describePaymentParties({
        ticketPurchase: {
          seeker: seeker(),
          tier: { event: { title: 'Full Moon Ceremony', guide: guide('Liana Guide') } },
        },
      }),
    ).toEqual({
      sourceType: 'EVENT',
      sourceLabel: 'Full Moon Ceremony',
      seekerName: 'Yana Seeker',
      guideName: 'Liana Guide',
    });
  });

  it('resolves a tour booking', () => {
    expect(
      describePaymentParties({
        tourBooking: { seeker: seeker(), tour: { title: 'Big Sur Retreat', guide: guide('Liana Guide') } },
      }),
    ).toEqual({
      sourceType: 'TOUR',
      sourceLabel: 'Big Sur Retreat',
      seekerName: 'Yana Seeker',
      guideName: 'Liana Guide',
    });
  });

  // ── Shop orders: no single seller ─────────────────────────────────────────

  it('resolves a single-guide shop order', () => {
    const res = describePaymentParties({
      order: {
        id: 'cmabcdef12345678',
        seeker: seeker(),
        items: [
          { product: { guide: guide('Liana Guide') } },
          { product: { guide: guide('Liana Guide') } },
        ],
      },
    });
    expect(res.sourceType).toBe('PRODUCT');
    expect(res.guideName).toBe('Liana Guide');
    // The id's tail is the reference support quotes; there is no order number.
    expect(res.sourceLabel).toBe('Order 12345678');
  });

  it('reports no single guide when an order spans several', () => {
    const res = describePaymentParties({
      order: {
        id: 'cmabcdef12345678',
        seeker: seeker(),
        items: [
          { product: { guide: guide('Liana Guide') } },
          { product: { guide: guide('Other Guide') } },
        ],
      },
    });
    // Null rather than a guess. Naming one seller for a basket spanning two
    // would be wrong in a financial view.
    expect(res.guideName).toBeNull();
    expect(res.seekerName).toBe('Yana Seeker');
  });

  // ── Name fallbacks ────────────────────────────────────────────────────────

  it("falls back to the guide's real name when displayName is unset", () => {
    const res = describePaymentParties({
      tourBooking: { seeker: seeker(), tour: { title: 'Retreat', guide: guide(null, 'Liana', 'Guide') } },
    });
    expect(res.guideName).toBe('Liana Guide');
  });

  it('tolerates a half-populated name', () => {
    const res = describePaymentParties({
      booking: { seeker: { user: { firstName: 'Yana', lastName: null } }, service: { name: 'S', guide: guide('G') } },
    });
    expect(res.seekerName).toBe('Yana');
  });

  // ── Nothing attached ──────────────────────────────────────────────────────

  it('returns UNKNOWN when no source is set, rather than throwing', () => {
    // Real for a subscription charge, and for a payment whose source row was
    // deleted. The row still belongs in the ledger.
    expect(describePaymentParties({})).toEqual({
      sourceType: 'UNKNOWN',
      sourceLabel: null,
      seekerName: null,
      guideName: null,
    });
  });
});
