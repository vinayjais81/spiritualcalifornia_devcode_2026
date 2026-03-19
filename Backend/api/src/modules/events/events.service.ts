import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireGuide(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new ForbiddenException('Guide profile not found');
    return guide;
  }

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

  async findByGuide(userId: string) {
    const guide = await this.requireGuide(userId);
    return this.prisma.event.findMany({
      where: { guideId: guide.id },
      include: { ticketTiers: true },
      orderBy: { startTime: 'asc' },
    });
  }

  async delete(userId: string, eventId: string) {
    const guide = await this.requireGuide(userId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.guideId !== guide.id) throw new ForbiddenException('Not your event');
    await this.prisma.event.delete({ where: { id: eventId } });
    return { deleted: true };
  }

  async publishAll(guideId: string) {
    await this.prisma.event.updateMany({
      where: { guideId, isPublished: false },
      data: { isPublished: true },
    });
  }
}
