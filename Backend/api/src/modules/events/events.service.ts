import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';
import { PaymentsService } from '../payments/payments.service';
import { PUBLIC_GUIDE_WHERE } from '../../common/public-visibility';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly payments: PaymentsService,
  ) {}

  // Bust the home-page snapshot whenever an event mutates. Without this, a
  // freshly-published event can be invisible on the home page for up to the
  // TTL of CacheService.keys.homeData (5 min) — and on a low-traffic dev
  // box, even longer because the cache key only refreshes on a cache miss
  // after expiry.
  private async invalidateHomeCache() {
    await this.cache.del(CacheService.keys.homeData());
  }

  /**
   * An event is "paid" if any of its currently-active ticket tiers has price > 0.
   * If no tiers exist yet (event still being authored), treat as not-paid —
   * the gate fires later when tiers are added.
   */
  private async eventIsPaid(eventId: string): Promise<boolean> {
    const tiers = await this.prisma.eventTicketTier.findMany({
      where: { eventId, isActive: true },
      select: { price: true },
    });
    return tiers.some((t) => Number(t.price) > 0);
  }

  private async requireGuide(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new ForbiddenException('Guide profile not found');
    return guide;
  }

  // ─── Create (draft) ────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateEventDto) {
    const guide = await this.requireGuide(userId);
    const startTime = new Date(dto.startTime);
    const endTime = dto.endTime
      ? new Date(dto.endTime)
      : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    const event = await this.prisma.event.create({
      data: {
        guideId: guide.id,
        title: dto.title,
        type: dto.type,
        startTime,
        endTime,
        timezone: dto.timezone ?? guide.timezone ?? 'America/Los_Angeles',
        location: dto.location,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        isPublished: false,
      },
    });

    if (dto.ticketPrice !== undefined && dto.ticketPrice >= 0) {
      await this.prisma.eventTicketTier.create({
        data: {
          eventId: event.id,
          name: 'General Admission',
          price: dto.ticketPrice,
          capacity: dto.ticketCapacity ?? 100,
        },
      });
    }

    this.logger.log(`Event "${event.title}" created (draft) for guide ${guide.id}`);

    return this.prisma.event.findUnique({
      where: { id: event.id },
      include: { ticketTiers: true },
    });
  }

  // ─── List Guide's Events (Dashboard) ───────────────────────────────────────

  async findByGuide(userId: string) {
    const guide = await this.requireGuide(userId);
    return this.prisma.event.findMany({
      where: { guideId: guide.id },
      include: { ticketTiers: true },
      orderBy: { startTime: 'asc' },
    });
  }

  // ─── List Published Events by Guide ID (Public Profile) ────────────────────

  async findPublishedByGuideId(guideId: string) {
    return this.prisma.event.findMany({
      where: { guideId, isPublished: true, isCancelled: false },
      include: { ticketTiers: true },
      orderBy: { startTime: 'asc' },
    });
  }

  // ─── List All Published Upcoming Events (Public) ────────────────────────────

  async findPublished(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    // Hide events whose guide has been deactivated. user.isActive is the
    // single source of truth — see docs/admin-activate-deactivate.md.
    const where = {
      isPublished: true,
      isCancelled: false,
      startTime: { gte: new Date() },
      guide: PUBLIC_GUIDE_WHERE,
    } as const;
    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          ticketTiers: { where: { isActive: true } },
          guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { events, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get Single Event (Public) ─────────────────────────────────────────────

  async findOne(eventId: string) {
    // Public surface — 404 unless the event is published and its guide is
    // publicly visible (verified, published, account active).
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, isPublished: true, guide: PUBLIC_GUIDE_WHERE },
      include: {
        // Active tiers only, matching findPublished. An inactive tier can't be
        // bought (eventCheckout rejects it), so listing it publicly just
        // advertises a ticket nobody can get — and it inflated the
        // availability count the detail page derives from these rows.
        ticketTiers: { where: { isActive: true } },
        guide: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            isVerified: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(userId: string, eventId: string, dto: UpdateEventDto) {
    const guide = await this.requireGuide(userId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.guideId !== guide.id) throw new ForbiddenException('Not your event');

    // The price lives on EventTicketTier, so it is resolved separately from the
    // Event columns below. Read the tiers up front: the payments gate has to
    // judge the state this update RESULTS IN, not the state on disk.
    const activeTiers = await this.prisma.eventTicketTier.findMany({
      where: { eventId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, price: true, sold: true },
    });
    // The dashboard only ever creates one tier ("General Admission"), so the
    // oldest active tier is the one its price field maps to. Any further tiers
    // are left alone but still count toward "is this event paid".
    const priceTier = activeTiers[0];

    // Payments gate: if this update would result in a paid+published event,
    // require Stripe Connect. The gate fires only on the transition to
    // published (or while-published) — editing a draft event is unaffected.
    //
    // `eventIsPaid` reads the database, which is the state BEFORE this update.
    // Once a price could be edited here that became a bypass: setting a free
    // published event to $50 would be waved through, because the gate looked at
    // the $0 still on disk. Fold the incoming price in instead.
    const finalPublished = dto.isPublished !== undefined ? !!dto.isPublished : event.isPublished;
    const finalIsPaid =
      dto.ticketPrice !== undefined
        ? dto.ticketPrice > 0 || activeTiers.slice(1).some((t) => Number(t.price) > 0)
        : activeTiers.some((t) => Number(t.price) > 0);
    if (finalPublished && finalIsPaid) {
      const gate = await this.payments.canPublishPaidOffering(guide.id);
      this.payments.assertCanPublishPaidOffering(gate);
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.startTime !== undefined) data.startTime = new Date(dto.startTime);
    if (dto.endTime !== undefined) data.endTime = new Date(dto.endTime);
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.isCancelled !== undefined) data.isCancelled = dto.isCancelled;

    // Event columns and the tier price move together: a partial write could
    // leave a published event paid while the gate had cleared it as free.
    const [updated] = await this.prisma.$transaction([
      this.prisma.event.update({
        where: { id: eventId },
        data,
        include: { ticketTiers: true },
      }),
      ...(dto.ticketPrice === undefined
        ? []
        : [
            priceTier
              ? this.prisma.eventTicketTier.update({
                  where: { id: priceTier.id },
                  data: { price: dto.ticketPrice },
                })
              : // An event created before the price field existed — or created
                // with no price at all — has no tier to update. Mint the same
                // one `create()` would have, so the price becomes editable
                // rather than silently going nowhere.
                this.prisma.eventTicketTier.create({
                  data: {
                    eventId,
                    name: 'General Admission',
                    price: dto.ticketPrice,
                    capacity: 100,
                  },
                }),
          ]),
    ]);

    if (dto.ticketPrice !== undefined && priceTier && priceTier.sold > 0) {
      // Past buyers keep what they paid (TicketPurchase.totalAmount is its own
      // column), so this is a pricing decision rather than a data problem — but
      // it should be visible if anyone ever asks why two attendees paid
      // different amounts for the same event.
      this.logger.log(
        `Event ${eventId}: tier price changed ${priceTier.price} -> ${dto.ticketPrice} with ${priceTier.sold} ticket(s) already sold`,
      );
    }

    // Any update may flip the publish/cancel/start-time state that the home
    // widget filters on — bust the cache unconditionally.
    await this.invalidateHomeCache();
    // Re-read so the response carries the new price rather than the tiers
    // captured before the tier write landed.
    return dto.ticketPrice === undefined
      ? updated
      : this.prisma.event.findUnique({ where: { id: eventId }, include: { ticketTiers: true } });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async delete(userId: string, eventId: string) {
    const guide = await this.requireGuide(userId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.guideId !== guide.id) throw new ForbiddenException('Not your event');
    await this.prisma.event.delete({ where: { id: eventId } });
    await this.invalidateHomeCache();
    return { deleted: true };
  }

  // ─── Publish All (Go Live) ─────────────────────────────────────────────────

  async publishAll(guideId: string) {
    // Programmatic "Go Live" from onboarding. Only publish events with
    // all-free tiers (or no tiers) when Stripe Connect isn't ready yet —
    // paid events stay drafts until the guide finishes onboarding.
    const drafts = await this.prisma.event.findMany({
      where: { guideId, isPublished: false },
      select: { id: true, ticketTiers: { where: { isActive: true }, select: { price: true } } },
    });
    if (drafts.length === 0) return;

    const hasPaidEvent = drafts.some((e) =>
      e.ticketTiers.some((t) => Number(t.price) > 0),
    );

    let publishAll = true;
    if (hasPaidEvent) {
      const gate = await this.payments.canPublishPaidOffering(guideId);
      publishAll = gate.allowed;
    }

    if (publishAll) {
      await this.prisma.event.updateMany({
        where: { guideId, isPublished: false },
        data: { isPublished: true },
      });
    } else {
      const freeIds = drafts
        .filter((e) => e.ticketTiers.every((t) => Number(t.price) === 0))
        .map((e) => e.id);
      if (freeIds.length > 0) {
        await this.prisma.event.updateMany({
          where: { id: { in: freeIds } },
          data: { isPublished: true },
        });
      }
      this.logger.log(
        `publishAll: guide ${guideId} has paid events but no Stripe Connect — only ${freeIds.length} free event(s) published`,
      );
    }
    await this.invalidateHomeCache();
  }
}
