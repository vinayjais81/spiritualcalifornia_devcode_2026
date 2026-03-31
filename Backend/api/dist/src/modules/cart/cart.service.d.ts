import { PrismaService } from '../../database/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
export declare class CartService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getOrCreateCart;
    getCart(userId?: string, sessionId?: string): Promise<{
        id: string;
        items: {
            details: any;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            metadata: import("@prisma/client/runtime/client").JsonValue | null;
            quantity: number;
            itemType: import(".prisma/client").$Enums.CartItemType;
            itemId: string;
            variantId: string | null;
            cartId: string;
        }[];
        itemCount: number;
    }>;
    addItem(dto: AddCartItemDto, userId?: string, sessionId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        quantity: number;
        itemType: import(".prisma/client").$Enums.CartItemType;
        itemId: string;
        variantId: string | null;
        cartId: string;
    }>;
    updateItem(itemId: string, dto: UpdateCartItemDto, userId?: string, sessionId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        quantity: number;
        itemType: import(".prisma/client").$Enums.CartItemType;
        itemId: string;
        variantId: string | null;
        cartId: string;
    }>;
    removeItem(itemId: string, userId?: string, sessionId?: string): Promise<{
        deleted: boolean;
    }>;
    clearCart(userId?: string, sessionId?: string): Promise<{
        cleared: boolean;
    }>;
    mergeGuestCart(userId: string, sessionId: string): Promise<void>;
}
