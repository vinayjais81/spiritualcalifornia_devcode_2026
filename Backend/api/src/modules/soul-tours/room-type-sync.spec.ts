import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SoulToursService } from './soul-tours.service';
import { StripeService } from '../payments/stripe.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../../database/cache.service';
import { PrismaService } from '../../database/prisma.service';

// Cover for the QA defect "not able to change the tour price".
//
// PUT /soul-tours/:id destructured `roomTypes` off the body so the spread into
// prisma.soulTour.update wouldn't choke on it, then never applied it — and the
// response included the pre-update rows, so the edit returned 200 with the old
// prices in it. The frontend had independently stopped sending room types on
// edit. Both halves are fixed; these tests pin the server half.
//
// The reconcile is the part worth guarding. `available` is live inventory
// decremented on every booking, so the naive delete-and-recreate would put
// sold-out rooms back on sale and strand the bookings pointing at them.

describe('SoulToursService — syncing room types on update', () => {
  let service: SoulToursService;
  let prisma: any;
  let tx: any;

  // 4 capacity, 1 left → 3 already sold.
  const DELUXE = {
    id: 'rt_deluxe',
    name: 'Deluxe',
    capacity: 4,
    available: 1,
    _count: { bookings: 3 },
  };
  // Nothing sold.
  const STANDARD = {
    id: 'rt_standard',
    name: 'Standard',
    capacity: 2,
    available: 2,
    _count: { bookings: 0 },
  };

  const room = (over: Record<string, unknown> = {}) => ({
    id: 'rt_deluxe',
    name: 'Deluxe',
    pricePerNight: 250,
    totalPrice: 1750,
    capacity: 4,
    amenities: ['Balcony'],
    ...over,
  });

  beforeEach(async () => {
    tx = {
      tourRoomType: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      tourRoomType: { findMany: jest.fn().mockResolvedValue([DELUXE, STANDARD]) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SoulToursService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: {} },
        { provide: PaymentsService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: CacheService, useValue: { del: jest.fn(), delPattern: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SoulToursService);
  });

  const sync = (incoming: any[]) => (service as any).syncRoomTypes('tour_1', incoming);

  // ── The reported defect ───────────────────────────────────────────────────

  it('writes the new price to the existing row', async () => {
    await sync([room({ pricePerNight: 310 }), { ...STANDARD, pricePerNight: 100, totalPrice: 700 }]);

    expect(tx.tourRoomType.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt_deluxe' },
        data: expect.objectContaining({ pricePerNight: 310 }),
      }),
    );
    // Updated in place — not recreated, which would mint a new id and orphan
    // every booking that references the old one.
    expect(tx.tourRoomType.create).not.toHaveBeenCalled();
    expect(tx.tourRoomType.delete).not.toHaveBeenCalled();
  });

  // ── Inventory must survive an edit ────────────────────────────────────────

  it('keeps sold seats sold when only the price changes', async () => {
    await sync([room({ pricePerNight: 310 }), { ...STANDARD }]);

    // 3 of 4 sold, capacity unchanged → still 1 available. A recreate would
    // have reset this to 4 and resold rooms that are already booked.
    expect(tx.tourRoomType.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ available: 1 }) }),
    );
  });

  it('re-derives availability from the sold count when capacity grows', async () => {
    await sync([room({ capacity: 10 }), { ...STANDARD }]);

    // 3 sold against a new capacity of 10 → 7 available, not 10.
    expect(tx.tourRoomType.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ capacity: 10, available: 7 }) }),
    );
  });

  it('allows shrinking capacity down to exactly what is sold', async () => {
    await sync([room({ capacity: 3 }), { ...STANDARD }]);

    // Closes the room to new sales without invalidating the 3 bookings.
    expect(tx.tourRoomType.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ capacity: 3, available: 0 }) }),
    );
  });

  it('refuses to set capacity below the number already booked', async () => {
    await expect(sync([room({ capacity: 2 }), { ...STANDARD }])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.tourRoomType.update).not.toHaveBeenCalled();
  });

  // ── Adding and removing ───────────────────────────────────────────────────

  it('creates a row that arrives without an id, fully available', async () => {
    await sync([room(), { ...STANDARD }, { name: 'Suite', pricePerNight: 500, totalPrice: 3500, capacity: 2 }]);

    expect(tx.tourRoomType.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Suite', capacity: 2, available: 2 }),
      }),
    );
  });

  it('deletes a row the guide removed when nothing is booked against it', async () => {
    await sync([room()]); // Standard dropped; it has 0 bookings

    expect(tx.tourRoomType.delete).toHaveBeenCalledWith({ where: { id: 'rt_standard' } });
  });

  it('refuses to delete a room type that has bookings, and names it', async () => {
    // Deluxe dropped, but 3 people are booked into it.
    await expect(sync([{ ...STANDARD, pricePerNight: 100, totalPrice: 700 }])).rejects.toThrow(
      /"Deluxe"/,
    );
    expect(tx.tourRoomType.delete).not.toHaveBeenCalled();
  });

  // ── Ownership ─────────────────────────────────────────────────────────────

  it("rejects an id that belongs to another tour", async () => {
    // Without this check the update would happily rewrite another guide's room.
    await expect(sync([room({ id: 'rt_someone_else' })])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.tourRoomType.update).not.toHaveBeenCalled();
  });

  // ── Ordering ──────────────────────────────────────────────────────────────

  it('renumbers sortOrder from the submitted order', async () => {
    await sync([{ ...STANDARD, pricePerNight: 100, totalPrice: 700 }, room()]);

    expect(tx.tourRoomType.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt_standard' },
        data: expect.objectContaining({ sortOrder: 0 }),
      }),
    );
    expect(tx.tourRoomType.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt_deluxe' },
        data: expect.objectContaining({ sortOrder: 1 }),
      }),
    );
  });
});
