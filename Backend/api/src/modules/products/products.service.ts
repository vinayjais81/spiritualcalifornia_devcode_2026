import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireGuide(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new ForbiddenException('Guide profile not found');
    return guide;
  }

  // ─── Create (draft) ────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateProductDto) {
    const guide = await this.requireGuide(userId);
    return this.prisma.product.create({
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
        isActive: dto.isActive ?? true,
      },
    });
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
    await this.prisma.product.updateMany({
      where: { guideId, isActive: false },
      data: { isActive: true },
    });
  }
}
