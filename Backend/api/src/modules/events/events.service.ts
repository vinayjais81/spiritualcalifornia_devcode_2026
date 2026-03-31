import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.prisma.event.updateMany({
      where: { guideId, isPublished: false },
      data: { isPublished: true },
    });
  }
}
