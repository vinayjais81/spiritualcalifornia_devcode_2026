import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EventsService } from './events.service';
import { PaymentsService } from '../payments/payments.service';
import { CacheService } from '../../database/cache.service';
import { PrismaService } from '../../database/prisma.service';

// Cover for the production defect "not able to change the price of the event".
//
// The price lives on EventTicketTier, not Event, and UpdateEventDto simply had
// no `ticketPrice` field — so the dashboard's Edit form hid the input entirely,
// and because the API runs ValidationPipe with `forbidNonWhitelisted`, sending
// one anyway would have been a 400. Three layers had to change; these tests pin
// the server half.
//
// The half worth guarding hardest is the payments gate. It asks "is this event
// paid?" by reading the tiers on disk — i.e. the state BEFORE the update. Once
// the price became editable that turned into a bypass: flipping a free
// published event to $50 would sail through, because the gate saw the $0 that
// had not been overwritten yet.

describe('EventsService — changing the ticket price on update', () => {
  let service: EventsService;
  let prisma: any;
  let payments: any;

  const GUIDE = { id: 'guide_1', userId: 'user_1', timezone: 'America/Los_Angeles' };
  const FREE_TIER = { id: 'tier_1', price: 0, sold: 0 };
  const PAID_TIER = { id: 'tier_1', price: 45, sold: 0 };

  /** Published unless a test says otherwise — the gate only fires when published. */
  const event = (over: Record<string, unknown> = {}) => ({
    id: 'evt_1', guideId: 'guide_1', isPublished: true, isCancelled: false, ...over,
  });

  const setup = async (opts: { tiers?: any[]; event?: any; gateAllowed?: boolean } = {}) => {
    payments = {
      canPublishPaidOffering: jest.fn().mockResolvedValue({ allowed: opts.gateAllowed ?? true }),
      assertCanPublishPaidOffering: jest.fn((gate: any) => {
        if (!gate.allowed) throw new ForbiddenException('Stripe Connect required');
      }),
    };

    prisma = {
      guideProfile: { findUnique: jest.fn().mockResolvedValue(GUIDE) },
      event: {
        findUnique: jest.fn().mockResolvedValue(opts.event ?? event()),
        update: jest.fn().mockReturnValue('EVENT_UPDATE_OP'),
      },
      eventTicketTier: {
        findMany: jest.fn().mockResolvedValue(opts.tiers ?? [FREE_TIER]),
        update: jest.fn().mockReturnValue('TIER_UPDATE_OP'),
        create: jest.fn().mockReturnValue('TIER_CREATE_OP'),
      },
      // Real $transaction takes the array of prepared operations; return a
      // matching-length result so the `const [updated]` destructure works.
      $transaction: jest.fn(async (ops: any[]) => ops.map(() => ({ id: 'evt_1' }))),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: payments },
        { provide: CacheService, useValue: { del: jest.fn(), delPattern: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(EventsService);
  };

  const update = (dto: any) => service.update('user_1', 'evt_1', dto);

  // ── The reported defect ───────────────────────────────────────────────────

  it('writes the new price to the existing tier', async () => {
    await setup({ tiers: [PAID_TIER] });
    await update({ ticketPrice: 75 });

    expect(prisma.eventTicketTier.update).toHaveBeenCalledWith({
      where: { id: 'tier_1' },
      data: { price: 75 },
    });
    expect(prisma.eventTicketTier.create).not.toHaveBeenCalled();
  });

  it('leaves the price alone when the field is omitted', async () => {
    await setup({ tiers: [PAID_TIER] });
    await update({ title: 'Renamed' });

    expect(prisma.eventTicketTier.update).not.toHaveBeenCalled();
    expect(prisma.eventTicketTier.create).not.toHaveBeenCalled();
  });

  it('can take a paid event back to free', async () => {
    // `|| undefined` on the client would have swallowed this 0, which is why
    // the frontend tests for an empty string instead.
    await setup({ tiers: [PAID_TIER] });
    await update({ ticketPrice: 0 });

    expect(prisma.eventTicketTier.update).toHaveBeenCalledWith({
      where: { id: 'tier_1' },
      data: { price: 0 },
    });
  });

  it('creates a tier for an event that has none', async () => {
    // Events created before the price field existed have no tier at all, so
    // there is nothing to update and the edit would silently do nothing.
    await setup({ tiers: [] });
    await update({ ticketPrice: 30 });

    expect(prisma.eventTicketTier.create).toHaveBeenCalledWith({
      data: { eventId: 'evt_1', name: 'General Admission', price: 30, capacity: 100 },
    });
  });

  it('writes the event and the tier in one transaction', async () => {
    // A partial write could leave a published event paid after the gate had
    // already cleared it as free.
    await setup({ tiers: [FREE_TIER] });
    await update({ ticketPrice: 20 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(['EVENT_UPDATE_OP', 'TIER_UPDATE_OP']);
  });

  // ── The payments gate must judge the resulting state ──────────────────────

  it('blocks turning a free published event paid without Stripe Connect', async () => {
    await setup({ tiers: [FREE_TIER], gateAllowed: false });

    await expect(update({ ticketPrice: 50 })).rejects.toThrow(ForbiddenException);
    // The write must not have happened.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not consult the gate when the event stays free', async () => {
    await setup({ tiers: [FREE_TIER], gateAllowed: false });
    await update({ ticketPrice: 0 });

    expect(payments.canPublishPaidOffering).not.toHaveBeenCalled();
  });

  it('does not consult the gate for a draft, whatever the price', async () => {
    await setup({ tiers: [FREE_TIER], event: event({ isPublished: false }), gateAllowed: false });
    await update({ ticketPrice: 90 });

    expect(payments.canPublishPaidOffering).not.toHaveBeenCalled();
    expect(prisma.eventTicketTier.update).toHaveBeenCalled();
  });

  it('still gates when a paid event is being published in the same call', async () => {
    await setup({ tiers: [FREE_TIER], event: event({ isPublished: false }), gateAllowed: false });

    await expect(update({ ticketPrice: 50, isPublished: true })).rejects.toThrow(ForbiddenException);
  });

  it('counts other tiers when deciding whether the event is paid', async () => {
    // Zeroing the first tier does not make the event free if a second paid
    // tier is still active.
    await setup({ tiers: [PAID_TIER, { id: 'tier_2', price: 120, sold: 0 }], gateAllowed: false });

    await expect(update({ ticketPrice: 0 })).rejects.toThrow(ForbiddenException);
  });

  it('only ever touches the oldest active tier', async () => {
    await setup({ tiers: [PAID_TIER, { id: 'tier_2', price: 120, sold: 0 }] });
    await update({ ticketPrice: 10 });

    expect(prisma.eventTicketTier.update).toHaveBeenCalledTimes(1);
    expect(prisma.eventTicketTier.update).toHaveBeenCalledWith({
      where: { id: 'tier_1' },
      data: { price: 10 },
    });
  });

  // ── Ownership ─────────────────────────────────────────────────────────────

  it("refuses to reprice another guide's event", async () => {
    await setup({ tiers: [PAID_TIER], event: event({ guideId: 'someone_else' }) });

    await expect(update({ ticketPrice: 1 })).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
