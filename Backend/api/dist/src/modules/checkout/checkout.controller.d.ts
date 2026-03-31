import { CheckoutService } from './checkout.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';
export declare class CheckoutController {
    private readonly checkoutService;
    constructor(checkoutService: CheckoutService);
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
    validatePromo(dto: ValidatePromoDto): Promise<{
        promoCodeId: string;
        code: string;
        type: import(".prisma/client").$Enums.PromoCodeType;
        discountAmount: number;
        description: string;
    }>;
    calculateSummary(data: any): Promise<{
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
