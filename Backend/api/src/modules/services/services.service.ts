import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ─────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateServiceDto) {
    const guide = await this.findGuideOrFail(userId);

    const service = await this.prisma.service.create({
      data: {
        guideId: guide.id,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        price: dto.price,
        durationMin: dto.durationMin,
      },
    });

    this.logger.log(`Service "${service.name}" created for guide ${guide.id}`);
    return service;
  }

  // ─── List My Services (Guide Dashboard) ──────────────────────────────────────

  async findByGuide(userId: string) {
    const guide = await this.findGuideOrFail(userId);

    return this.prisma.service.findMany({
      where: { guideId: guide.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── List Services for a Public Guide Profile ────────────────────────────────

  async findByGuideId(guideId: string) {
    return this.prisma.service.findMany({
      where: { guideId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Get Single Service (Public) ─────────────────────────────────────────────

  async findOne(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        guide: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            isVerified: true,
            user: {
              select: { avatarUrl: true },
            },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  async update(userId: string, serviceId: string, dto: UpdateServiceDto) {
    const guide = await this.findGuideOrFail(userId);
    const service = await this.findServiceOrFail(serviceId);

    if (service.guideId !== guide.id) {
      throw new ForbiddenException('You can only edit your own services');
    }

    const updated = await this.prisma.service.update({
      where: { id: serviceId },
      data: dto,
    });

    this.logger.log(`Service "${updated.name}" updated by guide ${guide.id}`);
    return updated;
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async delete(userId: string, serviceId: string) {
    const guide = await this.findGuideOrFail(userId);
    const service = await this.findServiceOrFail(serviceId);

    if (service.guideId !== guide.id) {
      throw new ForbiddenException('You can only delete your own services');
    }

    await this.prisma.service.delete({ where: { id: serviceId } });

    this.logger.log(`Service "${service.name}" deleted by guide ${guide.id}`);
    return { deleted: true };
  }

  // ─── Activate All (called from onboarding Go Live) ──────────────────────────

  async activateAll(guideId: string) {
    await this.prisma.service.updateMany({
      where: { guideId },
      data: { isActive: true },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async findGuideOrFail(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
    });

    if (!guide) {
      throw new NotFoundException('Guide profile not found. Complete onboarding first.');
    }

    return guide;
  }

  private async findServiceOrFail(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }
}
