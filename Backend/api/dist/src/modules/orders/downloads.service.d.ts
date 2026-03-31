import { PrismaService } from '../../database/prisma.service';
import { UploadService } from '../upload/upload.service';
export declare class DownloadsService {
    private readonly prisma;
    private readonly uploadService;
    constructor(prisma: PrismaService, uploadService: UploadService);
    getDownloadUrl(userId: string, orderId: string, orderItemId: string): Promise<{
        downloadUrl: string;
        fileName: string;
        fileKey: string;
        downloadCount: number;
    }>;
    getMyDownloads(userId: string): Promise<{
        orderId: string;
        orderItemId: string;
        productId: string;
        productName: string;
        guideName: string;
        guideSlug: string;
        imageUrl: string;
        digitalFiles: import("@prisma/client/runtime/client").JsonValue;
        downloadCount: number;
        purchasedAt: Date;
        hasFile: boolean;
    }[]>;
}
