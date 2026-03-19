import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
export declare class ProductsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private requireGuide;
    create(userId: string, dto: CreateProductDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        algoliaObjectId: string | null;
        guideId: string;
        type: import(".prisma/client").$Enums.ProductType;
        price: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        stockQuantity: number | null;
        imageUrls: string[];
        fileS3Key: string | null;
        shippingInfo: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    findByGuide(userId: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        algoliaObjectId: string | null;
        guideId: string;
        type: import(".prisma/client").$Enums.ProductType;
        price: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        stockQuantity: number | null;
        imageUrls: string[];
        fileS3Key: string | null;
        shippingInfo: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
    delete(userId: string, productId: string): Promise<{
        deleted: boolean;
    }>;
    publishAll(guideId: string): Promise<void>;
}
