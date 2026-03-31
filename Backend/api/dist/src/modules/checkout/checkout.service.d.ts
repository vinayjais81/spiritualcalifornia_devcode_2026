import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';
export declare class CheckoutService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    getShippingMethods(): Promise<{
        id: string;
        name: string;
        description: string | null;
        sortOrder: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        price: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        estimatedDaysMin: number;
        estimatedDaysMax: number;
    }[]>;
    getShippingMethod(id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        sortOrder: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        price: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        estimatedDaysMin: number;
        estimatedDaysMax: number;
    }>;
    calculateTax(state: string, taxableAmount: number): Promise<{
        rate: number;
        taxAmount: number;
        name: string;
    }>;
    getTaxRates(): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        state: string;
        country: string;
        rate: import("@prisma/client-runtime-utils").Decimal;
    }[]>;
    validatePromoCode(code: string, subtotal: number): Promise<{
        promoCodeId: string;
        code: string;
        type: import(".prisma/client").$Enums.PromoCodeType;
        discountAmount: number;
        description: string;
    }>;
    calculateOrderSummary(data: {
        items: Array<{
            productId: string;
            variantId?: string;
            quantity: number;
        }>;
        shippingMethodId?: string;
        promoCode?: string;
        state?: string;
    }): Promise<{
        items: {
            name: string;
            type: import(".prisma/client").$Enums.ProductType;
            unitPrice: number;
            quantity: number;
            lineTotal: number;
        }[];
        subtotal: number;
        discountAmount: number;
        promoDetails: {
            promoCodeId: string;
            code: string;
            type: string;
            discountAmount: number;
            description: string;
        } | null;
        shippingCost: number;
        shippingMethod: {
            name: string;
            estimatedDaysMin: number;
            estimatedDaysMax: number;
        } | null;
        taxAmount: number;
        taxDetails: {
            rate: number;
            taxAmount: number;
            name: string;
        } | null;
        totalAmount: number;
    }>;
}
