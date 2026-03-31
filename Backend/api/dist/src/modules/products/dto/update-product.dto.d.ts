import { ProductType } from '@prisma/client';
export declare class UpdateProductDto {
    name?: string;
    type?: ProductType;
    price?: number;
    description?: string;
    fileS3Key?: string;
    imageUrls?: string[];
    stockQuantity?: number;
    isActive?: boolean;
    digitalFiles?: any;
}
