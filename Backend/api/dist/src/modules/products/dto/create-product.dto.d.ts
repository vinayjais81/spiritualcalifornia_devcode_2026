import { ProductType } from '@prisma/client';
export declare class CreateProductDto {
    type: ProductType;
    name: string;
    price: number;
    description?: string;
    fileS3Key?: string;
    imageUrls?: string[];
    stockQuantity?: number;
    digitalFiles?: any;
}
