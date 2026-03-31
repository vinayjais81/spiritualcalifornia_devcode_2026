import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
export declare class CartController {
    private readonly cartService;
    constructor(cartService: CartService);
    getCart(user: CurrentUserData | null, sessionId?: string): Promise<{
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
    addItem(user: CurrentUserData | null, sessionId: string, dto: AddCartItemDto): Promise<{
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
    updateItem(user: CurrentUserData | null, sessionId: string, itemId: string, dto: UpdateCartItemDto): Promise<{
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
    removeItem(user: CurrentUserData | null, sessionId: string, itemId: string): Promise<{
        deleted: boolean;
    }>;
    clearCart(user: CurrentUserData): Promise<{
        cleared: boolean;
    }>;
    mergeGuestCart(user: CurrentUserData, sessionId: string): Promise<void>;
}
