import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateServiceDto) {
    const guide = await this.findGuideOrFail(userId);

    // Payments gate: services default to isActive=true. If this is a paid
    // service and the guide hasn't completed Stripe Connect, save the
    // record as a draft (isActive=false) so the form data isn't lost,
    // then throw 403 so the UI can show the publish-blocked modal.
    const isPaid = Number(dto.price) > 0;
    const gate = isPaid ? await this.payments.canPublishPaidOffering(guide.id) : null;
    const blocked = !!gate && !gate.allowed;

    const service = await this.prisma.service.create({
      data: {
        guideId: guide.id,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        price: dto.price,
        durationMin: dto.durationMin,
        isActive: blocked ? false : true,
      },
    });

    this.logger.log(
      `Service "${service.name}" created for guide ${guide.id}${blocked ? ' (saved as draft — payments gate blocked)' : ''}`,
    );

    if (blocked && gate) this.payments.assertCanPublishPaidOffering(gate);
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

    // Payments gate: if this update would result in a paid+active service,
    // require the guide's Stripe Connect to be set up. Lets free + draft
    // edits pass; only blocks the moment the guide tries to make money
    // visible without payment receipt configured.
    const finalPrice = dto.price !== undefined ? Number(dto.price) : Number(service.price);
    const finalActive = (dto as { isActive?: boolean }).isActive !== undefined
      ? !!(dto as { isActive?: boolean }).isActive
      : service.isActive;
    if (finalActive && finalPrice > 0) {
      const gate = await this.payments.canPublishPaidOffering(guide.id);
      this.payments.assertCanPublishPaidOffering(gate);
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
    // Programmatic "Go Live" from onboarding. New guides typically don't
    // have Stripe Connect yet, so activate free services unconditionally
    // but skip paid services if the gate fails — they stay as drafts
    // until the guide finishes Stripe onboarding. Never throws here so
    // onboarding flow isn't disrupted.
    const services = await this.prisma.service.findMany({
      where: { guideId },
      select: { id: true, price: true },
    });
    const hasPaid = services.some((s) => Number(s.price) > 0);

    let activateAll = true;
    if (hasPaid) {
      const gate = await this.payments.canPublishPaidOffering(guideId);
      activateAll = gate.allowed;
    }

    if (activateAll) {
      await this.prisma.service.updateMany({
        where: { guideId },
        data: { isActive: true },
      });
    } else {
      const freeIds = services.filter((s) => Number(s.price) === 0).map((s) => s.id);
      if (freeIds.length > 0) {
        await this.prisma.service.updateMany({
          where: { id: { in: freeIds } },
          data: { isActive: true },
        });
      }
      this.logger.log(
        `activateAll: guide ${guideId} has paid services but no Stripe Connect — only ${freeIds.length} free service(s) activated`,
      );
    }
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
