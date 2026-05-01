import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

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
    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where: { isPublished: true, isCancelled: false, startTime: { gte: new Date() } },
        include: {
          ticketTiers: { where: { isActive: true } },
          guide: { select: { displayName: true, slug: true, user: { select: { avatarUrl: true } } } },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.event.count({
        where: { isPublished: true, isCancelled: false, startTime: { gte: new Date() } },
      }),
    ]);
    return { events, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get Single Event (Public) ─────────────────────────────────────────────

  async findOne(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        ticketTiers: true,
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

    // Payments gate: if this update would result in a paid+published event,
    // require Stripe Connect. The gate fires only on the transition to
    // published (or while-published) — editing a draft event is unaffected.
    const finalPublished = dto.isPublished !== undefined ? !!dto.isPublished : event.isPublished;
    if (finalPublished && (await this.eventIsPaid(eventId))) {
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

    return this.prisma.event.update({
      where: { id: eventId },
      data,
      include: { ticketTiers: true },
    });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async delete(userId: string, eventId: string) {
    const guide = await this.requireGuide(userId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.guideId !== guide.id) throw new ForbiddenException('Not your event');
    await this.prisma.event.delete({ where: { id: eventId } });
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
  }
}
