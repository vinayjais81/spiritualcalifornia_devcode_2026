import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async requireGuide(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new ForbiddenException('Guide profile not found');
    return guide;
  }

  // ── Create (draft — isActive:false until guide goes live) ─────────────────

  async create(userId: string, dto: CreateProductDto) {
    const guide = await this.requireGuide(userId);
    return this.prisma.product.create({
      data: {
        guideId: guide.id,
        name: dto.name,
        type: dto.type,
        price: dto.price,
        description: dto.description,
        fileS3Key: dto.fileS3Key,
        imageUrls: dto.imageUrls ?? [],
        stockQuantity: dto.stockQuantity,
        isActive: false, // published when guide goes live
      },
    });
  }

  // ── List guide's own products ─────────────────────────────────────────────

  async findByGuide(userId: string) {
    const guide = await this.requireGuide(userId);
    return this.prisma.product.findMany({
      where: { guideId: guide.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(userId: string, productId: string) {
    const guide = await this.requireGuide(userId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.guideId !== guide.id) throw new ForbiddenException('Not your product');
    await this.prisma.product.delete({ where: { id: productId } });
    return { deleted: true };
  }

  // ── Publish all draft products for a guide (called from Go Live) ──────────

  async publishAll(guideId: string) {
    await this.prisma.product.updateMany({
      where: { guideId, isActive: false },
      data: { isActive: true },
    });
  }
}
