import { CartItemType } from '@prisma/client';
export declare class AddCartItemDto {
    itemType: CartItemType;
    itemId: string;
    variantId?: string;
    quantity?: number;
    metadata?: Record<string, any>;
}
