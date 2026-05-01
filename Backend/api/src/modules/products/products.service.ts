import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  private async requireGuide(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new ForbiddenException('Guide profile not found');
    return guide;
  }

  // ─── Create (draft) ────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateProductDto) {
    const guide = await this.requireGuide(userId);

    // Payments gate: products default to isActive=true. If this is a paid
    // product and the guide hasn't completed Stripe Connect, save the row
    // as a draft (isActive=false) so the form data isn't lost, then throw
    // 403 so the UI can show the publish-blocked modal.
    const isPaid = Number(dto.price) > 0;
    const requestedActive = dto.isActive ?? true;
    const gate =
      isPaid && requestedActive
        ? await this.payments.canPublishPaidOffering(guide.id)
        : null;
    const blocked = !!gate && !gate.allowed;

    const product = await this.prisma.product.create({
      data: {
        guideId: guide.id,
        name: dto.name,
        type: dto.type,
        category: dto.category,
        price: dto.price,
        description: dto.description,
        fileS3Key: dto.fileS3Key,
        digitalFiles: dto.digitalFiles ?? undefined,
        imageUrls: dto.imageUrls ?? [],
        stockQuantity: dto.stockQuantity,
        isActive: blocked ? false : requestedActive,
      },
    });

    this.logger.log(
      `Product "${product.name}" created for guide ${guide.id}${blocked ? ' (saved as draft — payments gate blocked)' : ''}`,
    );

    if (blocked && gate) this.payments.assertCanPublishPaidOffering(gate);
    return product;
  }

  // ─── List Guide's Products (Dashboard) ─────────────────────────────────────

  async findByGuide(userId: string) {
    const guide = await this.requireGuide(userId);
    return this.prisma.product.findMany({
      where: { guideId: guide.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── List Active Products by Guide ID (Public Profile) ─────────────────────

  async findActiveByGuideId(guideId: string) {
    return this.prisma.product.findMany({
      where: { guideId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── List All Active Products (Public Storefront) ──────────────────────────

  async findPublic(limit = 50, page = 1, type?: string, category?: string) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (type === 'DIGITAL' || type === 'PHYSICAL') where.type = type;

    const VALID_CATEGORIES = [
      'CRYSTALS', 'SOUND_HEALING', 'AROMATHERAPY', 'BOOKS_COURSES',
      'DIGITAL_DOWNLOADS', 'RITUAL_TOOLS', 'JEWELRY_MALAS', 'GIFT_BUNDLES', 'ART',
    ];
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          guide: {
            select: { id: true, slug: true, displayName: true, isVerified: true, user: { select: { avatarUrl: true } } },
          },
          variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get Single Product (Public) ───────────────────────────────────────────

  async findOne(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        guide: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            isVerified: true,
            tagline: true,
            user: { select: { avatarUrl: true } },
          },
        },
        variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(userId: string, productId: string, dto: UpdateProductDto) {
    const guide = await this.requireGuide(userId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.guideId !== guide.id) throw new ForbiddenException('Not your product');

    // Payments gate: if this update would result in a paid+active product,
    // require Stripe Connect.
    const finalPrice = dto.price !== undefined ? Number(dto.price) : Number(product.price);
    const finalActive = (dto as { isActive?: boolean }).isActive !== undefined
      ? !!(dto as { isActive?: boolean }).isActive
      : product.isActive;
    if (finalActive && finalPrice > 0) {
      const gate = await this.payments.canPublishPaidOffering(guide.id);
      this.payments.assertCanPublishPaidOffering(gate);
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: dto,
    });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async delete(userId: string, productId: string) {
    const guide = await this.requireGuide(userId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.guideId !== guide.id) throw new ForbiddenException('Not your product');
    await this.prisma.product.delete({ where: { id: productId } });
    return { deleted: true };
  }

  // ─── Publish All (Go Live) ─────────────────────────────────────────────────

  async publishAll(guideId: string) {
    // Programmatic "Go Live" from onboarding. Activate free products
    // unconditionally; activate paid products only if Stripe Connect is
    // ready. Never throws — onboarding flow stays smooth.
    const drafts = await this.prisma.product.findMany({
      where: { guideId, isActive: false },
      select: { id: true, price: true },
    });
    if (drafts.length === 0) return;

    const hasPaid = drafts.some((p) => Number(p.price) > 0);

    let activateAll = true;
    if (hasPaid) {
      const gate = await this.payments.canPublishPaidOffering(guideId);
      activateAll = gate.allowed;
    }

    if (activateAll) {
      await this.prisma.product.updateMany({
        where: { guideId, isActive: false },
        data: { isActive: true },
      });
    } else {
      const freeIds = drafts.filter((p) => Number(p.price) === 0).map((p) => p.id);
      if (freeIds.length > 0) {
        await this.prisma.product.updateMany({
          where: { id: { in: freeIds } },
          data: { isActive: true },
        });
      }
      this.logger.log(
        `publishAll: guide ${guideId} has paid products but no Stripe Connect — only ${freeIds.length} free product(s) activated`,
      );
    }
  }
}
