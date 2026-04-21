import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UploadService } from '../upload/upload.service';

/** 7 days — long enough that a customer opening the receipt email on the weekend still works. */
const EMAIL_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
/** 1 hour — used when the dashboard streams a fresh URL just to hand to a single click. */
const DASHBOARD_URL_TTL_SECONDS = 60 * 60;

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Generate a fresh signed URL for every digital item in an order and cache it
   * on OrderItem.downloadUrl with a 7-day expiry. Called by PaymentsService
   * when an order transitions to PAID, so the confirmation email and the
   * confirmation screen can link directly to usable downloads.
   *
   * Returns `[{ orderItemId, productName, downloadUrl }]` for the confirmation
   * email template.
   */
  async generateDownloadUrlsForOrder(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        product: { type: 'DIGITAL' },
      },
      include: {
        product: { select: { id: true, name: true, fileS3Key: true } },
      },
    });

    const expiresAt = new Date(Date.now() + EMAIL_URL_TTL_SECONDS * 1000);
    const results: Array<{ orderItemId: string; productName: string; downloadUrl: string }> = [];

    for (const item of items) {
      if (!item.product.fileS3Key) {
        this.logger.warn(
          `Digital product ${item.product.id} has no fileS3Key — skipping URL generation for orderItem ${item.id}`,
        );
        continue;
      }
      try {
        const downloadUrl = await this.uploadService.getPresignedDownloadUrl(
          item.product.fileS3Key,
          EMAIL_URL_TTL_SECONDS,
          `${item.product.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${item.product.fileS3Key.split('.').pop() || 'zip'}`,
        );
        await this.prisma.orderItem.update({
          where: { id: item.id },
          data: { downloadUrl, downloadUrlExpiresAt: expiresAt },
        });
        results.push({
          orderItemId: item.id,
          productName: item.product.name,
          downloadUrl,
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to generate download URL for orderItem ${item.id}: ${err?.message}`,
          err?.stack,
        );
      }
    }

    return results;
  }

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

    // Reuse the cached URL from the order-PAID step if it's still valid.
    // Otherwise mint a fresh one (shorter TTL — the dashboard is interactive).
    const cachedUrl = item.downloadUrl;
    const cachedExpiresAt = (item as any).downloadUrlExpiresAt as Date | null | undefined;
    const stillValid =
      cachedUrl &&
      cachedExpiresAt &&
      new Date(cachedExpiresAt).getTime() > Date.now() + 60_000; // 60s safety margin

    let downloadUrl: string;
    let newExpiresAt: Date | undefined;
    if (stillValid) {
      downloadUrl = cachedUrl!;
    } else {
      downloadUrl = await this.uploadService.getPresignedDownloadUrl(
        s3Key,
        DASHBOARD_URL_TTL_SECONDS,
        `${item.product.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${s3Key.split('.').pop() || 'zip'}`,
      );
      newExpiresAt = new Date(Date.now() + DASHBOARD_URL_TTL_SECONDS * 1000);
    }

    // Track download count + refresh cached URL if we generated a new one
    await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        downloadCount: { increment: 1 },
        ...(newExpiresAt ? { downloadUrl, downloadUrlExpiresAt: newExpiresAt } : {}),
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
