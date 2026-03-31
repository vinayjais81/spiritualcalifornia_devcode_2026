import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
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
        digitalFiles: import("@prisma/client/runtime/client").JsonValue | null;
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
        digitalFiles: import("@prisma/client/runtime/client").JsonValue | null;
        shippingInfo: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
    findActiveByGuideId(guideId: string): Promise<{
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
        digitalFiles: import("@prisma/client/runtime/client").JsonValue | null;
        shippingInfo: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
    findPublic(limit?: number, page?: number, type?: string): Promise<{
        products: ({
            guide: {
                id: string;
                slug: string;
                user: {
                    avatarUrl: string | null;
                };
                displayName: string;
                isVerified: boolean;
            };
            variants: {
                id: string;
                name: string;
                sortOrder: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                price: import("@prisma/client-runtime-utils").Decimal | null;
                stockQuantity: number;
                productId: string;
                sku: string | null;
                attributes: import("@prisma/client/runtime/client").JsonValue | null;
            }[];
        } & {
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
            digitalFiles: import("@prisma/client/runtime/client").JsonValue | null;
            shippingInfo: import("@prisma/client/runtime/client").JsonValue | null;
        })[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findOne(productId: string): Promise<{
        guide: {
            id: string;
            slug: string;
            user: {
                avatarUrl: string | null;
            };
            displayName: string;
            tagline: string | null;
            isVerified: boolean;
        };
        variants: {
            id: string;
            name: string;
            sortOrder: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            price: import("@prisma/client-runtime-utils").Decimal | null;
            stockQuantity: number;
            productId: string;
            sku: string | null;
            attributes: import("@prisma/client/runtime/client").JsonValue | null;
        }[];
    } & {
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
        digitalFiles: import("@prisma/client/runtime/client").JsonValue | null;
        shippingInfo: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    update(userId: string, productId: string, dto: UpdateProductDto): Promise<{
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
        digitalFiles: import("@prisma/client/runtime/client").JsonValue | null;
        shippingInfo: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    delete(userId: string, productId: string): Promise<{
        deleted: boolean;
    }>;
    publishAll(guideId: string): Promise<void>;
}
