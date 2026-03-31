import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Get a signed download URL for a purchased digital product.
   * Validates: order is paid, item exists in order, product is digital, user owns the order.
   */
  async getDownloadUrl(userId: string, orderId: string, orderItemId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) throw new ForbiddenException('Seeker profile not found');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, type: true, fileS3Key: true, digitalFiles: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.seekerId !== seeker.id) throw new ForbiddenException('Not your order');
    if (order.status !== 'PAID' && order.status !== 'DELIVERED') {
      throw new BadRequestException('Order has not been paid yet');
    }

    const item = order.items.find((i) => i.id === orderItemId);
    if (!item) throw new NotFoundException('Order item not found');
    if (item.product.type !== 'DIGITAL') throw new BadRequestException('This is not a digital product');

    const s3Key = item.product.fileS3Key;
    if (!s3Key) throw new BadRequestException('No file attached to this product');

    // Generate signed download URL (valid for 1 hour)
    const downloadUrl = await this.uploadService.getPresignedDownloadUrl(
      s3Key,
      3600,
      `${item.product.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${s3Key.split('.').pop() || 'zip'}`,
    );

    // Track download count
    await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        downloadCount: { increment: 1 },
        downloadUrl, // Cache the latest URL for reference
      },
    });

    return {
      downloadUrl,
      fileName: item.product.name,
      fileKey: s3Key,
      downloadCount: item.downloadCount + 1,
    };
  }

  /**
   * List all downloadable items from a user's paid orders.
   */
  async getMyDownloads(userId: string) {
    const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!seeker) return [];

    const orders = await this.prisma.order.findMany({
      where: {
        seekerId: seeker.id,
        status: { in: ['PAID', 'DELIVERED'] },
      },
      include: {
        items: {
          where: { product: { type: 'DIGITAL' } },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                type: true,
                fileS3Key: true,
                digitalFiles: true,
                imageUrls: true,
                guide: { select: { displayName: true, slug: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        orderItemId: item.id,
        productId: item.product.id,
        productName: item.product.name,
        guideName: item.product.guide.displayName,
        guideSlug: item.product.guide.slug,
        imageUrl: item.product.imageUrls?.[0] ?? null,
        digitalFiles: item.product.digitalFiles,
        downloadCount: item.downloadCount,
        purchasedAt: order.createdAt,
        hasFile: !!item.product.fileS3Key,
      })),
    );
  }
}
