import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    findOne(id: string): Promise<{
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
    }>;
    refund(id: string, amount?: number): Promise<{
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
    }>;
    handleWebhook(req: RawBodyRequest<Request>): Promise<{
        received: boolean;
    }> | {
        received: boolean;
        error: string;
    };
    connectOnboard(user: CurrentUserData): Promise<{
        alreadyOnboarded: boolean;
        dashboardUrl: string;
        status: {
            chargesEnabled: boolean;
            payoutsEnabled: boolean;
            detailsSubmitted: boolean;
        };
        onboardingUrl?: undefined;
        accountId?: undefined;
    } | {
        onboardingUrl: string;
        alreadyOnboarded?: undefined;
        dashboardUrl?: undefined;
        status?: undefined;
        accountId?: undefined;
    } | {
        accountId: string;
        onboardingUrl: string;
        alreadyOnboarded?: undefined;
        dashboardUrl?: undefined;
        status?: undefined;
    }>;
    connectStatus(user: CurrentUserData): Promise<{
        connected: boolean;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
    } | {
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
        connected: boolean;
    }>;
    getEarnings(user: CurrentUserData): Promise<{
        balance: {
            available: number;
            pending: number;
            totalEarned: number;
            totalPaidOut: number;
        };
        recentPayments: {
            id: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
            guideAmount: import("@prisma/client-runtime-utils").Decimal;
            paymentType: import(".prisma/client").$Enums.PaymentType;
            paymentMethod: string | null;
        }[];
        stripeConnected: boolean;
    }>;
    requestPayout(user: CurrentUserData, amount: number): Promise<{
        id: string;
        createdAt: Date;
        guideId: string;
        currency: string;
        status: import(".prisma/client").$Enums.PayoutStatus;
        amount: import("@prisma/client-runtime-utils").Decimal;
        processedAt: Date | null;
        stripePayoutId: string | null;
        payoutAccountId: string;
    }>;
    createIntent(data: {
        amount: number;
        bookingId?: string;
        orderId?: string;
        ticketPurchaseId?: string;
        tourBookingId?: string;
        paymentType?: 'FULL' | 'DEPOSIT' | 'BALANCE';
    }): Promise<{
        paymentId: string;
        clientSecret: string;
        paymentIntentId: string;
        amount: number;
        currency: string;
    }>;
    confirmPayment(data: {
        paymentIntentId: string;
    }): Promise<{
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
    } | undefined>;
}
