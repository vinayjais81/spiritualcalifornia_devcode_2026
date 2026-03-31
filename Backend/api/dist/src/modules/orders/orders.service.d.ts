import { PrismaService } from '../../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutService } from '../checkout/checkout.service';
export declare class OrdersService {
    private readonly prisma;
    private readonly paymentsService;
    private readonly checkoutService;
    constructor(prisma: PrismaService, paymentsService: PaymentsService, checkoutService: CheckoutService);
    create(userId: string, dto: CreateOrderDto): Promise<{
        order: {
            items: ({
                product: {
                    name: string;
                    type: import(".prisma/client").$Enums.ProductType;
                    imageUrls: string[];
                };
            } & {
                id: string;
                createdAt: Date;
                orderId: string;
                quantity: number;
                productId: string;
                variantId: string | null;
                unitPrice: import("@prisma/client-runtime-utils").Decimal;
                downloadUrl: string | null;
                downloadCount: number;
            })[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            status: import(".prisma/client").$Enums.OrderStatus;
            totalAmount: import("@prisma/client-runtime-utils").Decimal;
            notes: string | null;
            seekerId: string;
            taxRate: import("@prisma/client-runtime-utils").Decimal | null;
            contactFirstName: string | null;
            contactLastName: string | null;
            contactEmail: string | null;
            contactPhone: string | null;
            subtotal: import("@prisma/client-runtime-utils").Decimal;
            discountAmount: import("@prisma/client-runtime-utils").Decimal;
            shippingCost: import("@prisma/client-runtime-utils").Decimal;
            taxAmount: import("@prisma/client-runtime-utils").Decimal;
            shippingAddress: import("@prisma/client/runtime/client").JsonValue | null;
            promoCodeId: string | null;
            shippingMethodId: string | null;
        };
        paymentIntent: {
            paymentId: string;
            clientSecret: string;
            paymentIntentId: string;
            amount: number;
            currency: string;
        };
    }>;
    findMyOrders(userId: string): Promise<({
        payment: {
            status: import(".prisma/client").$Enums.PaymentStatus;
            paymentMethod: string | null;
        } | null;
        items: ({
            product: {
                name: string;
                type: import(".prisma/client").$Enums.ProductType;
                imageUrls: string[];
            };
        } & {
            id: string;
            createdAt: Date;
            orderId: string;
            quantity: number;
            productId: string;
            variantId: string | null;
            unitPrice: import("@prisma/client-runtime-utils").Decimal;
            downloadUrl: string | null;
            downloadCount: number;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        seekerId: string;
        taxRate: import("@prisma/client-runtime-utils").Decimal | null;
        contactFirstName: string | null;
        contactLastName: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        subtotal: import("@prisma/client-runtime-utils").Decimal;
        discountAmount: import("@prisma/client-runtime-utils").Decimal;
        shippingCost: import("@prisma/client-runtime-utils").Decimal;
        taxAmount: import("@prisma/client-runtime-utils").Decimal;
        shippingAddress: import("@prisma/client/runtime/client").JsonValue | null;
        promoCodeId: string | null;
        shippingMethodId: string | null;
    })[]>;
    findOne(userId: string, orderId: string): Promise<{
        payment: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            status: import(".prisma/client").$Enums.PaymentStatus;
            stripePaymentIntentId: string;
            stripeCheckoutSessionId: string | null;
            stripeTransferId: string | null;
            amount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
            guideAmount: import("@prisma/client-runtime-utils").Decimal;
            paymentType: import(".prisma/client").$Enums.PaymentType;
            refundedAmount: import("@prisma/client-runtime-utils").Decimal | null;
            stripeRefundId: string | null;
            paymentMethod: string | null;
            metadata: import("@prisma/client/runtime/client").JsonValue | null;
            bookingId: string | null;
            orderId: string | null;
            ticketPurchaseId: string | null;
            tourBookingId: string | null;
        } | null;
        shippingMethod: {
            name: string;
            estimatedDaysMin: number;
            estimatedDaysMax: number;
        } | null;
        promoCode: {
            type: import(".prisma/client").$Enums.PromoCodeType;
            amount: import("@prisma/client-runtime-utils").Decimal;
            code: string;
        } | null;
        items: ({
            product: {
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
            };
        } & {
            id: string;
            createdAt: Date;
            orderId: string;
            quantity: number;
            productId: string;
            variantId: string | null;
            unitPrice: import("@prisma/client-runtime-utils").Decimal;
            downloadUrl: string | null;
            downloadCount: number;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        seekerId: string;
        taxRate: import("@prisma/client-runtime-utils").Decimal | null;
        contactFirstName: string | null;
        contactLastName: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        subtotal: import("@prisma/client-runtime-utils").Decimal;
        discountAmount: import("@prisma/client-runtime-utils").Decimal;
        shippingCost: import("@prisma/client-runtime-utils").Decimal;
        taxAmount: import("@prisma/client-runtime-utils").Decimal;
        shippingAddress: import("@prisma/client/runtime/client").JsonValue | null;
        promoCodeId: string | null;
        shippingMethodId: string | null;
    }>;
}
