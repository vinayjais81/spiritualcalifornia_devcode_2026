import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    create(user: CurrentUserData, dto: CreateProductDto): Promise<{
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
    findMine(user: CurrentUserData): Promise<{
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
    findOne(id: string): Promise<{
        guide: {
            id: string;
            slug: string;
            user: {
                avatarUrl: string | null;
            };
            displayName: string;
            isVerified: boolean;
        };
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
    update(user: CurrentUserData, id: string, dto: UpdateProductDto): Promise<{
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
    remove(user: CurrentUserData, id: string): Promise<{
        deleted: boolean;
    }>;
}
